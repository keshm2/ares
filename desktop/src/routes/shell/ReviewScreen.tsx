import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AplyxState, QueueEntry } from "@aplyx/core/stateDerive.js";
import { isResolved } from "@aplyx/core/stateDerive.js";
import { findRoot, loadLocalState, markQueueEntryApplied, dismissQueueEntry } from "../../lib/bridge";
import "../../components/formFields.css";
import "../../components/dataList.css";

export function ReviewScreen() {
  const [root, setRoot] = useState<string | undefined>(undefined);
  const [state, setState] = useState<AplyxState | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | undefined>(undefined);

  const refresh = async (r: string) => {
    setState((await loadLocalState(r)) as AplyxState);
  };

  useEffect(() => {
    findRoot()
      .then(async (r) => {
        setRoot(r);
        await refresh(r);
      })
      .catch(() => setState(undefined))
      .finally(() => setLoaded(true));
  }, []);

  const entries = useMemo(
    () => (state ? state.queue.filter((e) => showResolved || !isResolved(state, e)) : []),
    [state, showResolved],
  );
  const selectedEntry = entries.find((e) => e.job_id === selected);

  const open = async (entry: QueueEntry) => {
    try {
      await openUrl(entry.apply_url || entry.url);
      setMessage({ text: `Opened ${entry.apply_url || entry.url}` });
    } catch (err) {
      setMessage({ text: `Could not open: ${err instanceof Error ? err.message : String(err)}`, error: true });
    }
  };

  const markApplied = async (entry: QueueEntry) => {
    if (!root) return;
    setBusy(true);
    try {
      const result = await markQueueEntryApplied(root, entry);
      setMessage({ text: result.message });
      await refresh(root);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (entry: QueueEntry) => {
    if (!root) return;
    setBusy(true);
    try {
      const result = await dismissQueueEntry(root, entry);
      setMessage({ text: result.message });
      await refresh(root);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aplyx-fade-rise" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div>
        <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: "var(--space-2)" }}>Review queue</h1>
        <div className="data-toolbar">
          <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            {entries.length} {showResolved ? "total" : "pending"}
          </span>
          <div className="data-toolbar-spacer" />
          <button
            type="button"
            className={showResolved ? "source-toggle on" : "source-toggle"}
            onClick={() => setShowResolved((s) => !s)}
          >
            Show resolved
          </button>
        </div>
      </div>

      {message ? (
        <div className={message.error ? "message-banner message-banner-error" : "message-banner"}>{message.text}</div>
      ) : null}

      <div className="data-screen">
        <div className="data-list-col">
          {!loaded ? (
            <div className="data-empty">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="data-empty">
              Nothing to review — {showResolved ? "the queue is empty" : "new items appear as the agent runs"}.
            </div>
          ) : (
            <div className="data-list">
              {entries.map((entry) => {
                const resolved = state ? isResolved(state, entry) : false;
                return (
                  <button
                    key={entry.job_id}
                    type="button"
                    className={entry.job_id === selected ? "data-row selected" : "data-row"}
                    onClick={() => setSelected(entry.job_id)}
                  >
                    <div className="data-row-main">
                      <span className="data-row-title">
                        {entry.company} — {entry.title}
                      </span>
                      <span className="data-row-sub">
                        {typeof entry.ats_score === "number" ? `ats ${entry.ats_score}` : entry.source ?? ""}
                      </span>
                    </div>
                    <span className={resolved ? "status-badge status-badge-good" : "status-badge status-badge-warn"}>
                      {resolved ? "Resolved" : "Pending"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedEntry ? (
          <div className="detail-col">
            <div className="detail-title">
              {selectedEntry.company} — {selectedEntry.title}
            </div>
            {typeof selectedEntry.ats_score === "number" ? (
              <div className="detail-row">
                <span className="detail-row-label">ATS score</span>
                <span className="detail-row-value">
                  {selectedEntry.ats_score} · {selectedEntry.source ?? "?"}
                </span>
              </div>
            ) : null}
            {selectedEntry.resume_used ? (
              <div className="detail-row">
                <span className="detail-row-label">Resume</span>
                <span className="detail-row-value">{selectedEntry.resume_used}</span>
              </div>
            ) : null}
            <div className="detail-row">
              <span className="detail-row-label">URL</span>
              <span className="detail-row-value">{selectedEntry.url}</span>
            </div>
            {selectedEntry.reasoning ? (
              <>
                <hr className="detail-rule" />
                <div className="detail-row">
                  <span className="detail-row-label">Why</span>
                  <span className="detail-row-value">{selectedEntry.reasoning}</span>
                </div>
              </>
            ) : null}
            <hr className="detail-rule" />
            <div className="detail-actions">
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void open(selectedEntry)}>
                Open
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => void markApplied(selectedEntry)}
              >
                Mark applied
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busy}
                onClick={() => void dismiss(selectedEntry)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
