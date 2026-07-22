import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { BUILD_MARKER } from "@aplyx/core/version.js";
import { useAuth } from "../../lib/AuthContext";
import { findRoot, hasLocalInstall, setLocalRoot, forgetLocalRoot } from "../../lib/bridge";
import { useUiPrefs, type FontPref, type ThemePref } from "../../lib/uiPrefs";
import "../../components/formFields.css";

const THEME_OPTIONS: { value: ThemePref; label: string; detail: string }[] = [
  { value: "system", label: "System", detail: "Follow the OS appearance" },
  { value: "light", label: "Light", detail: "Warm beige, always" },
  { value: "dark", label: "Dark", detail: "Near-black plum, always" },
];

const FONT_OPTIONS: { value: FontPref; label: string; detail: string }[] = [
  { value: "system", label: "System", detail: "Your OS's native UI font" },
  { value: "geist", label: "Geist", detail: "Bundled Geist + Geist Mono" },
];

export function SettingsScreen() {
  const { status, session, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, font, setTheme, setFont } = useUiPrefs();
  const [root, setRoot] = useState<string | undefined>(undefined);
  const [browsing, setBrowsing] = useState(false);
  const [rootError, setRootError] = useState<string | undefined>(undefined);

  const refreshLocalInstall = () => {
    hasLocalInstall().then((has) => {
      setRoot(undefined);
      if (has) findRoot().then(setRoot);
    });
  };

  useEffect(refreshLocalInstall, []);

  async function browseForRoot() {
    setBrowsing(true);
    setRootError(undefined);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select your aplyx checkout folder",
      });
      if (typeof selected !== "string") return; // cancelled
      const resolved = await setLocalRoot(selected);
      setRoot(resolved);
    } catch (err) {
      setRootError(err instanceof Error ? err.message : String(err));
    } finally {
      setBrowsing(false);
    }
  }

  function changeFolder() {
    forgetLocalRoot();
    void browseForRoot();
  }

  return (
    <div className="aplyx-fade-rise" style={{ maxWidth: "34rem", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-3xl)" }}>Settings</h1>

      <section>
        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Account</h2>
        {status === "signed-in" ? (
          <div className="check-row">
            <span className="check-icon check-icon-ok">✓</span>
            <div style={{ flex: 1 }}>
              <div className="check-label">{session?.user.email}</div>
              <div className="check-detail">Signed in — your profile syncs across devices.</div>
            </div>
            <button type="button" className="wizard-back" onClick={() => signOut().then(() => navigate("/"))}>
              Sign out
            </button>
          </div>
        ) : (
          <div className="check-row">
            <span className="check-icon check-icon-pending">–</span>
            <div style={{ flex: 1 }}>
              <div className="check-label">Not signed in</div>
              <div className="check-detail">Running locally. Sign in to sync across devices.</div>
            </div>
            <button type="button" className="wizard-back" onClick={() => navigate("/auth")}>
              Sign in
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Appearance</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="field">
            <span className="field-label">Theme</span>
            <div className="yesno-toggle" role="group" aria-label="Theme">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={theme === opt.value ? "selected" : ""}
                  title={opt.detail}
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="field-help">
              Light is a warm beige, dark matches the aplyx logo badge. System follows your OS
              and switches automatically.
            </p>
          </div>
          <div className="field">
            <span className="field-label">Font</span>
            <div className="yesno-toggle" role="group" aria-label="Font">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={font === opt.value ? "selected" : ""}
                  title={opt.detail}
                  onClick={() => setFont(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="field-help">
              Geist is bundled with the app (no download). It applies to the whole interface,
              including headlines and code.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Local install</h2>
        {root ? (
          <div className="check-row">
            <span className="check-icon check-icon-ok">✓</span>
            <div style={{ flex: 1 }}>
              <div className="check-label">Connected</div>
              <div className="check-detail">{root}</div>
            </div>
            <button type="button" className="wizard-back" onClick={changeFolder} disabled={browsing}>
              {browsing ? "Choosing…" : "Change folder…"}
            </button>
            <button type="button" className="wizard-back" onClick={() => navigate("/onboarding/local")}>
              Reopen setup
            </button>
          </div>
        ) : (
          <div className="check-row">
            <span className="check-icon check-icon-pending">–</span>
            <div style={{ flex: 1 }}>
              <div className="check-label">No local installation found</div>
              <div className="check-detail">
                Job search and applying run through a local install — point the app at your aplyx
                checkout folder.
              </div>
            </div>
            <button type="button" className="wizard-back" onClick={() => void browseForRoot()} disabled={browsing}>
              {browsing ? "Choosing…" : "Browse…"}
            </button>
          </div>
        )}
        {rootError ? <p className="field-help" style={{ color: "var(--danger)" }}>{rootError}</p> : null}
      </section>

      {/* Same build marker the TUI shows (dimmed) in its side panel footer
       * — one shared @aplyx/core constant, so both surfaces always agree. */}
      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>build {BUILD_MARKER}</p>
    </div>
  );
}
