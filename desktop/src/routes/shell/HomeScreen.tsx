import { useEffect, useState } from "react";
import type { AplyxState } from "@aplyx/core/state.js";
import { useAuth } from "../../lib/AuthContext";
import { findRoot, loadLocalState, hasLocalInstall } from "../../lib/bridge";
import "../../components/formFields.css";

export function HomeScreen() {
  const { status, session } = useAuth();
  const [local, setLocal] = useState<AplyxState | undefined>(undefined);
  const [checkedLocal, setCheckedLocal] = useState(false);

  useEffect(() => {
    hasLocalInstall()
      .then(async (has) => {
        if (has) {
          const root = await findRoot();
          const state = (await loadLocalState(root)) as AplyxState | null;
          setLocal(state ?? undefined);
        }
      })
      // A bridge failure reads the same as "no local activity" — the
      // no-activity copy below already covers that case.
      .finally(() => setCheckedLocal(true));
  }, []);

  const hosted = status === "signed-in";

  return (
    <div className="aplyx-fade-rise" style={{ maxWidth: "38rem", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-2)" }}>
          {local?.applied?.length ? "Welcome back" : "You're set up"}
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          {hosted ? (
            <>
              Signed in as <strong>{session?.user.email}</strong>.
            </>
          ) : (
            "Running locally — your data stays on this machine."
          )}
        </p>
      </div>

      {checkedLocal && local && (
        <div className="option-list aplyx-fade-in">
          <div className="check-row">
            <span className="check-icon check-icon-ok">{local.applied.length}</span>
            <div className="check-label">Applications sent</div>
          </div>
          <div className="check-row">
            <span className="check-icon check-icon-pending">{local.queue.length}</span>
            <div className="check-label">Waiting in review queue</div>
          </div>
          <div className="check-row">
            <span className="check-icon check-icon-pending">{local.registry.length}</span>
            <div className="check-label">Jobs seen</div>
          </div>
        </div>
      )}

      {checkedLocal && !local && (
        <p className="field-help aplyx-fade-in">
          {hosted
            ? "No local aplyx installation is connected on this machine yet — job search and applying still run locally, so connect one from Settings to see activity here."
            : "No activity yet — head to Jobs to start searching."}
        </p>
      )}
    </div>
  );
}
