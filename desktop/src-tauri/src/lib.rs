// Local-mode IPC: the frontend calls these narrow, typed commands via
// invoke() rather than being granted a general shell-execute permission.
// Each command shells out (Rust-side only) to the shared @applyr/core
// bridge CLI (packages/core/src/bridge.ts) over stdio — a spawned
// subprocess, not a localhost server — reusing the exact same profile/state
// logic the Ink TUI already uses. Hosted mode bypasses this entirely: the
// frontend talks to Supabase directly via @supabase/supabase-js.
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;

/// Dev-mode resolution of the bridge script, relative to this crate's
/// manifest dir (desktop/src-tauri). Packaging the bridge as a bundled
/// Tauri resource/sidecar for a distributable end-user build is a separate,
/// later distribution-readiness pass — Phase 14A targets local development
/// on a full applyr checkout, same as the TUI does today.
fn bridge_script_path() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let path = manifest_dir
        .join("..")
        .join("..")
        .join("packages")
        .join("core")
        .join("dist")
        .join("bridge.js");
    if path.exists() {
        Ok(path)
    } else {
        Err(format!(
            "core bridge not found at {} — run `npm run build:core` from the repo root",
            path.display()
        ))
    }
}

/// A Finder-launched .app inherits launchd's minimal PATH
/// (/usr/bin:/bin:/usr/sbin:/sbin), which does not include Homebrew, nvm,
/// or Volta install locations — so `Command::new("node")` works under
/// `tauri dev` (terminal PATH) but fails in the installed bundle. That
/// spawn failure surfaced as the auth screen hanging on "Checking sign-in
/// availability…" forever. Probe the common install locations before
/// falling back to PATH lookup.
fn node_binary() -> PathBuf {
    for p in [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/opt/local/bin/node",
    ] {
        let path = PathBuf::from(p);
        if path.exists() {
            return path;
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let volta = PathBuf::from(&home).join(".volta").join("bin").join("node");
        if volta.exists() {
            return volta;
        }
        let nvm_versions = PathBuf::from(&home).join(".nvm").join("versions").join("node");
        if let Ok(entries) = std::fs::read_dir(&nvm_versions) {
            let mut nodes: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path().join("bin").join("node"))
                .filter(|p| p.exists())
                .collect();
            nodes.sort();
            if let Some(newest) = nodes.pop() {
                return newest;
            }
        }
    }
    PathBuf::from("node")
}

fn run_bridge(command: &str, args: Option<Value>) -> Result<Value, String> {
    let script = bridge_script_path()?;
    let mut cmd = Command::new(node_binary());
    cmd.arg(&script).arg(command);
    if let Some(a) = &args {
        cmd.arg(a.to_string());
    }
    let output = cmd
        .output()
        .map_err(|e| format!("failed to spawn node ({}): {e}", script.display()))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: Value = serde_json::from_str(stdout.trim()).map_err(|e| {
        let stderr = String::from_utf8_lossy(&output.stderr);
        format!("bridge produced non-JSON output: {e} (stdout: {stdout}, stderr: {stderr})")
    })?;
    let ok = parsed.get("ok").and_then(Value::as_bool).unwrap_or(false);
    if ok {
        Ok(parsed.get("result").cloned().unwrap_or(Value::Null))
    } else {
        Err(parsed
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("bridge command failed")
            .to_string())
    }
}

#[tauri::command]
fn find_root() -> Result<Value, String> {
    run_bridge("findRoot", None)
}

#[tauri::command]
fn ensure_targets_file(root: String) -> Result<Value, String> {
    run_bridge("ensureTargetsFile", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn read_profile_field(root: String, id: String) -> Result<Value, String> {
    run_bridge(
        "readProfileField",
        Some(serde_json::json!({ "root": root, "id": id })),
    )
}

#[tauri::command]
fn write_profile_field(root: String, id: String, value: Value) -> Result<Value, String> {
    run_bridge(
        "writeProfileField",
        Some(serde_json::json!({ "root": root, "id": id, "value": value })),
    )
}

#[tauri::command]
fn load_local_state(root: String) -> Result<Value, String> {
    run_bridge("loadState", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn run_validator(root: String) -> Result<Value, String> {
    run_bridge("runValidator", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn read_supabase_config(root: String) -> Result<Value, String> {
    run_bridge("readSupabaseConfig", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn detect_harnesses() -> Result<Value, String> {
    run_bridge("detectHarnesses", None)
}

#[tauri::command]
fn list_companies(root: String) -> Result<Value, String> {
    run_bridge("listCompanies", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn read_harness(root: String) -> Result<Value, String> {
    run_bridge("readHarness", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn write_harness(root: String, harness: String) -> Result<Value, String> {
    run_bridge(
        "writeHarness",
        Some(serde_json::json!({ "root": root, "harness": harness })),
    )
}

#[tauri::command]
fn read_discord_config(root: String) -> Result<Value, String> {
    run_bridge("readDiscordConfig", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn write_discord_config(root: String, enabled: Option<bool>, routes: Value) -> Result<Value, String> {
    run_bridge(
        "writeDiscordConfig",
        Some(serde_json::json!({ "root": root, "enabled": enabled, "routes": routes })),
    )
}

#[tauri::command]
fn list_resumes(root: String) -> Result<Value, String> {
    run_bridge("listResumes", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn convert_resume(root: String, stem: String, description: Option<String>) -> Result<Value, String> {
    run_bridge(
        "convertResume",
        Some(serde_json::json!({ "root": root, "stem": stem, "description": description.unwrap_or_default() })),
    )
}

#[tauri::command]
fn import_resume_file(root: String, source_path: String, stem: String) -> Result<Value, String> {
    run_bridge(
        "importResumeFile",
        Some(serde_json::json!({ "root": root, "sourcePath": source_path, "stem": stem })),
    )
}

#[tauri::command]
fn open_extension_folder(root: String) -> Result<Value, String> {
    run_bridge("openExtensionFolder", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn read_onboarding_completed(root: String) -> Result<Value, String> {
    run_bridge("readOnboardingCompleted", Some(serde_json::json!({ "root": root })))
}

#[tauri::command]
fn write_onboarding_completed(root: String, completed: bool) -> Result<Value, String> {
    run_bridge(
        "writeOnboardingCompleted",
        Some(serde_json::json!({ "root": root, "completed": completed })),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Auth callback deep link (applyr://auth-callback — see
        // desktop/src/lib/AuthContext.tsx). Works out of the box on macOS
        // once the app is bundled+installed. On Windows/Linux, a deep-link
        // click spawns a NEW app instance with the URL as a CLI arg rather
        // than routing into this one — combine with tauri-plugin-single-
        // instance before shipping cross-platform; not added yet since
        // this pass only needed macOS to work.
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            find_root,
            ensure_targets_file,
            read_profile_field,
            write_profile_field,
            load_local_state,
            run_validator,
            read_supabase_config,
            detect_harnesses,
            list_companies,
            read_harness,
            write_harness,
            read_discord_config,
            write_discord_config,
            list_resumes,
            convert_resume,
            import_resume_file,
            open_extension_folder,
            read_onboarding_completed,
            write_onboarding_completed
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
