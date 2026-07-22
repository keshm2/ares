/**
 * Pure, fs-free state shapes and derivations — split out of state.ts so the
 * desktop app's webview (which can't import node:fs) can use them directly
 * against a AplyxState it already loaded via the bridge, without pulling in
 * the fs-based readers too (same reason hostedFields.ts was split from
 * profile.ts). state.ts re-exports everything here for the TUI/Node side.
 */

export interface AppliedJob {
  job_id: string;
  company: string;
  title: string;
  url: string;
  apply_url?: string;
  date_applied: string;
  status: "applied" | "failed" | "needs_review";
  role_type?: string;
  source?: string;
  resume_used?: string;
  ats_score?: number;
  location_tier?: string;
  cover_letter_used?: boolean;
  reasoning?: string;
}

export interface QueueEntry extends Omit<AppliedJob, "status"> {
  status?: string;
}

export interface RegistryRecord {
  job_key: string;
  job_id: string;
  company?: string;
  title?: string;
  latest_status?: string;
  url?: string;
  internship_term?: string;
}

export interface AplyxState {
  applied: AppliedJob[];
  queue: QueueEntry[];
  registry: RegistryRecord[];
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Registry record for a queue/applied entry, matched by job_id. */
export function registryByJobId(
  registry: RegistryRecord[],
  jobId: string,
): RegistryRecord | undefined {
  return registry.find((r) => r.job_id === jobId);
}

/**
 * A queue entry is resolved when a later outcome exists for it: an
 * applied/failed entry in applied_jobs, or a registry latest_status that
 * moved past needs_review. The queue file itself is append-only (helper
 * discipline), so "resolved" is derived, never deleted.
 */
export function isResolved(state: AplyxState, entry: QueueEntry): boolean {
  const outcome = state.applied.find(
    (a) => a.job_id === entry.job_id && a.status !== "needs_review",
  );
  if (outcome) return true;
  const rec = registryByJobId(state.registry, entry.job_id);
  return (
    rec?.latest_status === "applied" ||
    rec?.latest_status === "failed" ||
    rec?.latest_status === "skipped_unfit"
  );
}

/**
 * A queue entry has a terminal applied/failed outcome when an
 * applied_jobs entry records that status, or the registry's
 * latest_status is applied or failed. Used to guard dismiss() from
 * overwriting a real outcome with skipped_unfit.
 */
export function hasAppliedOrFailed(state: AplyxState, entry: QueueEntry): boolean {
  const outcome = state.applied.find(
    (a) => a.job_id === entry.job_id && (a.status === "applied" || a.status === "failed"),
  );
  if (outcome) return true;
  const rec = registryByJobId(state.registry, entry.job_id);
  return rec?.latest_status === "applied" || rec?.latest_status === "failed";
}

/**
 * A queue entry is already dismissed when its registry latest_status is
 * skipped_unfit. Used by dismiss() to avoid re-dismissing (and recording a
 * duplicate skipped_unfit event for) an entry already resolved as dismissed.
 */
export function isDismissed(state: AplyxState, entry: QueueEntry): boolean {
  const rec = registryByJobId(state.registry, entry.job_id);
  return rec?.latest_status === "skipped_unfit";
}

export interface Heartbeat {
  last_run_completed_at: string;
  last_run_exit_code: number;
  last_run_counts: Record<string, number>;
  run_counter: number;
  consecutive_nonzero_exits: number;
}
