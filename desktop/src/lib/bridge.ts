import { invoke } from "@tauri-apps/api/core";

/**
 * Thin typed wrappers around the Rust IPC commands defined in
 * desktop/src-tauri/src/lib.rs, which themselves shell out to the shared
 * @applyr/core bridge CLI (packages/core/src/bridge.ts). This is the only
 * module in the frontend that calls invoke() directly — every screen goes
 * through here instead, so the IPC surface stays in one place.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let cachedRoot: string | undefined;

/** The local applyr installation root, resolved once per app session. */
export async function findRoot(): Promise<string> {
  if (cachedRoot) return cachedRoot;
  const result = await invoke<{ root: string }>("find_root");
  cachedRoot = result.root;
  return cachedRoot;
}

export async function ensureTargetsFile(root: string): Promise<void> {
  await invoke("ensure_targets_file", { root });
}

export async function readProfileField(root: string, id: string): Promise<string | string[]> {
  const result = await invoke<{ value: string | string[] }>("read_profile_field", { root, id });
  return result.value;
}

export async function writeProfileField(root: string, id: string, value: string | string[]): Promise<void> {
  await invoke("write_profile_field", { root, id, value });
}

export async function loadLocalState(root: string): Promise<unknown> {
  return invoke("load_local_state", { root });
}

export async function runValidator(root: string): Promise<{ ok: boolean; output: string }> {
  return invoke("run_validator", { root });
}

/** Returns undefined when config/supabase.json is missing or still holds
 *  the example placeholders — the caller shows a "hosted mode isn't
 *  configured yet" state rather than treating this as a hard error. */
export async function readSupabaseConfig(root: string): Promise<SupabaseConfig | undefined> {
  const result = await invoke<SupabaseConfig | null>("read_supabase_config", { root });
  return result ?? undefined;
}

/** True when a local applyr installation was found — i.e. findRoot()
 *  resolved instead of throwing. Used to decide whether "Run locally" can
 *  proceed straight to onboarding or needs an install-location step first. */
export async function hasLocalInstall(): Promise<boolean> {
  try {
    await findRoot();
    return true;
  } catch {
    return false;
  }
}

export async function readOnboardingCompleted(root: string): Promise<boolean> {
  const result = await invoke<{ completed: boolean }>("read_onboarding_completed", { root });
  return result.completed;
}

export async function writeOnboardingCompleted(root: string, completed: boolean): Promise<void> {
  await invoke("write_onboarding_completed", { root, completed });
}

/** Deduped company display names from the local install's vetted slug
 *  lists — the autocomplete pool for target-company tags. */
export async function listCompanies(root: string): Promise<string[]> {
  const result = await invoke<{ companies: string[] }>("list_companies", { root });
  return result.companies;
}

export async function detectHarnesses(): Promise<string[]> {
  const result = await invoke<{ detected: string[] }>("detect_harnesses");
  return result.detected;
}

export async function writeHarness(root: string, harness: string): Promise<void> {
  await invoke("write_harness", { root, harness });
}

export interface DiscordConfig {
  enabled: boolean;
  applied: string;
  needs_review: string;
  failed: string;
  summary: string;
}

export async function readDiscordConfig(root: string): Promise<DiscordConfig> {
  return invoke<DiscordConfig>("read_discord_config", { root });
}

export async function writeDiscordConfig(root: string, config: DiscordConfig): Promise<void> {
  await invoke("write_discord_config", {
    root,
    enabled: config.enabled,
    routes: { applied: config.applied, needs_review: config.needs_review, failed: config.failed, summary: config.summary },
  });
}

export async function listResumes(root: string): Promise<string[]> {
  const result = await invoke<{ files: string[] }>("list_resumes", { root });
  return result.files;
}

export async function importResumeFile(root: string, sourcePath: string, stem: string): Promise<void> {
  await invoke("import_resume_file", { root, sourcePath, stem });
}

export async function convertResume(root: string, stem: string): Promise<{ ok: boolean; error?: string }> {
  return invoke("convert_resume", { root, stem });
}

export async function openExtensionFolder(root: string): Promise<void> {
  await invoke("open_extension_folder", { root });
}
