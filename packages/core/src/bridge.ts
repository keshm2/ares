#!/usr/bin/env node
import { findProjectRoot } from "./project.js";
import {
  ensureTargetsFile,
  readDiscordEnabled,
  writeDiscordEnabled,
  readDiscordRoute,
  writeDiscordRoute,
  readOnboardingCompleted,
  writeOnboardingCompleted,
} from "./settings.js";
import { runValidator, convertResumePdf, openPath } from "./helpers.js";
import { LocalAdapter } from "./adapters/local.js";
import { readSupabaseConfig } from "./supabaseConfig.js";
import { detectAllHarnessesOnPath, readHarnessConfig, writeHarnessConfig, isKnownHarness } from "./harness.js";
import { loadCompanyDirectory } from "./data/companyDirectory.js";
import fs from "node:fs";
import path from "node:path";

/**
 * Local-mode IPC bridge for the Tauri desktop app (docs/app-integration-plan.md
 * "Adapter seam"). The frontend never touches node:fs/child_process directly —
 * a Tauri webview can't — so the Rust shell (desktop/src-tauri) spawns this as
 * a subprocess (stdio, not a localhost server) and passes one command name
 * plus one JSON-args blob per invocation. This dispatcher reuses
 * @applyr/core's existing functions verbatim; it adds no new business logic.
 *
 * Usage: applyr-core-bridge <command> [jsonArgs]
 * Prints one JSON line to stdout: { ok: true, result } or { ok: false, error }.
 */

type Args = Record<string, unknown>;

function parseArgs(raw: string | undefined): Args {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("bridge args must be a JSON object");
  }
  return parsed as Args;
}

function resolveRoot(args: Args): string {
  if (typeof args.root === "string" && args.root) return args.root;
  return findProjectRoot();
}

async function dispatch(command: string, args: Args): Promise<unknown> {
  switch (command) {
    case "findRoot":
      return { root: findProjectRoot() };

    case "ensureTargetsFile": {
      const root = resolveRoot(args);
      ensureTargetsFile(root);
      return { ok: true };
    }

    case "readProfileField": {
      const root = resolveRoot(args);
      const id = String(args.id ?? "");
      if (!id) throw new Error("readProfileField requires { id }");
      const adapter = new LocalAdapter(root);
      return { value: await adapter.readProfileField(id) };
    }

    case "writeProfileField": {
      const root = resolveRoot(args);
      const id = String(args.id ?? "");
      if (!id) throw new Error("writeProfileField requires { id }");
      const value = args.value as string | string[];
      const adapter = new LocalAdapter(root);
      await adapter.writeProfileField(id, value);
      return { ok: true };
    }

    case "loadState": {
      const root = resolveRoot(args);
      const adapter = new LocalAdapter(root);
      return (await adapter.loadState()) ?? null;
    }

    case "runValidator": {
      const root = resolveRoot(args);
      return runValidator(root);
    }

    case "readSupabaseConfig": {
      const root = resolveRoot(args);
      return readSupabaseConfig(root) ?? null;
    }

    case "detectHarnesses":
      return { detected: detectAllHarnessesOnPath() };

    case "listCompanies": {
      const root = resolveRoot(args);
      const seen = new Set<string>();
      const companies: string[] = [];
      for (const entry of loadCompanyDirectory(root)) {
        if (seen.has(entry.display)) continue;
        seen.add(entry.display);
        companies.push(entry.display);
      }
      return { companies };
    }

    case "readHarness": {
      const root = resolveRoot(args);
      return { harness: readHarnessConfig(root) ?? null };
    }

    case "writeHarness": {
      const root = resolveRoot(args);
      const harness = String(args.harness ?? "");
      if (!isKnownHarness(harness)) throw new Error(`unknown harness: ${harness}`);
      writeHarnessConfig(root, harness);
      return { ok: true };
    }

    case "readDiscordConfig": {
      const root = resolveRoot(args);
      return {
        enabled: readDiscordEnabled(root),
        applied: readDiscordRoute(root, "applied"),
        needs_review: readDiscordRoute(root, "needs_review"),
        failed: readDiscordRoute(root, "failed"),
        summary: readDiscordRoute(root, "summary"),
      };
    }

    case "writeDiscordConfig": {
      const root = resolveRoot(args);
      if (typeof args.enabled === "boolean") writeDiscordEnabled(root, args.enabled);
      const routes = (args.routes as Record<string, string> | undefined) ?? {};
      for (const [route, url] of Object.entries(routes)) {
        writeDiscordRoute(root, route, url);
      }
      return { ok: true };
    }

    case "listResumes": {
      const root = resolveRoot(args);
      const dir = path.join(root, "data", "resumes");
      try {
        return { files: fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")) };
      } catch {
        return { files: [] };
      }
    }

    case "convertResume": {
      const root = resolveRoot(args);
      const stem = String(args.stem ?? "");
      if (!stem) throw new Error("convertResume requires { stem }");
      const description = String(args.description ?? "");
      return convertResumePdf(root, stem, description);
    }

    case "importResumeFile": {
      const root = resolveRoot(args);
      const sourcePath = String(args.sourcePath ?? "");
      const stem = String(args.stem ?? "");
      if (!sourcePath || !stem) throw new Error("importResumeFile requires { sourcePath, stem }");
      const dir = path.join(root, "data", "resumes");
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, `${stem}.pdf`);
      fs.copyFileSync(sourcePath, dest);
      return { ok: true, path: dest };
    }

    case "openExtensionFolder": {
      const root = resolveRoot(args);
      openPath(path.join(root, "extension"));
      return { ok: true };
    }

    case "readOnboardingCompleted": {
      const root = resolveRoot(args);
      return { completed: readOnboardingCompleted(root) };
    }

    case "writeOnboardingCompleted": {
      const root = resolveRoot(args);
      writeOnboardingCompleted(root, Boolean(args.completed));
      return { ok: true };
    }

    default:
      throw new Error(`unknown bridge command: ${command}`);
  }
}

async function main(): Promise<void> {
  const [command, rawArgs] = process.argv.slice(2);
  if (!command) {
    process.stderr.write("usage: applyr-core-bridge <command> [jsonArgs]\n");
    process.exit(2);
  }
  try {
    const result = await dispatch(command, parseArgs(rawArgs));
    process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
    process.exit(1);
  }
}

main();
