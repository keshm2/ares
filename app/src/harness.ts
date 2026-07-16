import fs from "node:fs";
import path from "node:path";
import { effectiveEnv } from "./settings.js";
import type { HarnessId } from "./theme.js";

const KNOWN: ReadonlySet<string> = new Set(["claude", "opencode", "codex", "copilot"]);

function isKnown(value: string): value is Exclude<HarnessId, "auto"> {
  return KNOWN.has(value);
}

function readHarnessConfigFile(root: string): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, "config", "harness.json"), "utf8"));
    return typeof parsed?.harness === "string" ? parsed.harness.trim() : "";
  } catch {
    return "";
  }
}

/** Same resolution order run_job_agent.py uses ahead of its own PATH
 *  auto-detect (APPLYR_HARNESS/ARES_HARNESS env override, then
 *  config/harness.json): env override wins, then the config file, else
 *  "auto" — there's no CLI-on-PATH probe here since this only drives a
 *  cosmetic wave color, not the actual subprocess invocation. */
export function resolveHarnessId(root: string): HarnessId {
  const fromEnv = effectiveEnv(root, "APPLYR_HARNESS", "").value.trim();
  if (isKnown(fromEnv)) return fromEnv;
  const fromConfig = readHarnessConfigFile(root);
  if (isKnown(fromConfig)) return fromConfig;
  return "auto";
}
