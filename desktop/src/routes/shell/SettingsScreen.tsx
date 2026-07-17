import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BUILD_MARKER } from "@applyr/core/version.js";
import { useAuth } from "../../lib/AuthContext";
import { findRoot, hasLocalInstall } from "../../lib/bridge";
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

  useEffect(() => {
    hasLocalInstall().then((has) => {
      if (has) findRoot().then(setRoot);
    });
  }, []);

  return (
    <div style={{ maxWidth: "34rem", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
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
              Light is a warm beige, dark matches the applyr logo badge. System follows your OS
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
            <button type="button" className="wizard-back" onClick={() => navigate("/onboarding/local")}>
              Reopen setup
            </button>
          </div>
        ) : (
          <div className="check-row">
            <span className="check-icon check-icon-pending">–</span>
            <div style={{ flex: 1 }}>
              <div className="check-label">No local installation found</div>
              <div className="check-detail">Job search and applying run through a local install.</div>
            </div>
          </div>
        )}
      </section>

      {/* Same build marker the TUI shows (dimmed) in its side panel footer
       * — one shared @applyr/core constant, so both surfaces always agree. */}
      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>build {BUILD_MARKER}</p>
    </div>
  );
}
