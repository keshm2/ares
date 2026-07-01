#!/bin/bash
# Job application agent — cron-driven entry point.
# Schedule: crontab -e, then add: 0 2 * * * /full/path/to/ares/scripts/run_job_agent.sh
# Adjust the cd path below to your actual project root.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

mkdir -p data logs

RUN_LOG="logs/run_job_agent.log"

# --- Overlap protection (portable, macOS-safe, no flock) --------------------
# mkdir is atomic on macOS/Linux, so a lock directory is a portable lock.
# A pid file inside it lets us detect and reclaim a stale lock left by a
# crashed previous run (kill -0 is portable).
LOCK_DIR="logs/.run_job_agent.lock"
LOCK_PID="$LOCK_DIR/pid"

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$LOCK_PID"
    return 0
  fi
  local old_pid
  old_pid="$(cat "$LOCK_PID" 2>/dev/null || true)"
  if [ -n "$old_pid" ] && ! kill -0 "$old_pid" 2>/dev/null; then
    # Stale lock — holder is no longer alive. Reclaim it.
    rm -rf "$LOCK_DIR"
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      echo "$$" > "$LOCK_PID"
      return 0
    fi
  fi
  return 1
}

if ! acquire_lock; then
  echo "[$(date)] SKIPPED: another run is already in progress (lock: $LOCK_DIR)" >> "$RUN_LOG"
  exit 0
fi
trap 'rm -rf "$LOCK_DIR" 2>/dev/null' EXIT

# --- Config validation -----------------------------------------------------
# Fails fast on missing/invalid live config or missing required fields.
# Placeholder Ashby/Lever slugs produce warnings but do not block the run.
if ! bash scripts/validate_local_config.sh "$PROJECT_ROOT"; then
  echo "[$(date)] ABORTED: local config validation failed. Run manually to fix." >> "$RUN_LOG"
  exit 1
fi

# --- Ensure persistent state files exist as valid JSON arrays ---------------
bash scripts/append_state_entry.sh ensure data/applied_jobs.json \
  || { echo "[$(date)] ABORTED: failed to ensure data/applied_jobs.json. Run manually to fix." >> "$RUN_LOG"; exit 1; }
bash scripts/append_state_entry.sh ensure data/review_queue.json \
  || { echo "[$(date)] ABORTED: failed to ensure data/review_queue.json. Run manually to fix." >> "$RUN_LOG"; exit 1; }

# --- Ensure canonical registry + internal event log (Phase 1) --------------
python3 scripts/job_state.py ensure-files \
  || { echo "[$(date)] ABORTED: failed to ensure canonical registry/event files. Run manually to fix." >> "$RUN_LOG"; exit 1; }

# --- Run the agent ---------------------------------------------------------
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_LOG="logs/session_${TIMESTAMP}.log"

RUN_RC=0
opencode run \
  --agent job-scraper \
  --print \
  "Start a new job application run. Read AGENTS.md, load data/applied_jobs.json
   and config/targets.json, scrape all configured job boards, deduplicate,
   tailor and apply to matching roles within the session cap, and send a
   Discord summary when complete." \
  >> "$SESSION_LOG" 2>&1 || RUN_RC=$?

if [ "$RUN_RC" -ne 0 ]; then
  echo "[$(date)] FAILED: opencode run exited non-zero (rc=$RUN_RC). Log: $SESSION_LOG" >> "$RUN_LOG"
  exit "$RUN_RC"
fi

echo "[$(date)] Session complete. Log: $SESSION_LOG" >> "$RUN_LOG"