# Release notes — applyr 0.8.041a

> **Build:** `0.8.041a` — alpha.
> **Branch:** `main`.
> **TUI in-app marker:** `app/src/theme.ts` →
> `BUILD_MARKER = "0.8.041a"` (visible in the TUI side-panel footer).
> **npm package:** `@keshm/applyr` version `0.8.41-alpha.0`, published
> to the default `latest` dist-tag — `npm install -g @keshm/applyr`
> gets it. The unscoped npm name `applyr` belongs to an unrelated
> package — never `npm install applyr`. npm requires strict semver,
> which disallows leading zeros in a numeric identifier, so the human
> marker `0.8.041a` maps to semver `0.8.41-alpha.0` (npm would
> silently strip the zero on publish either way — set explicitly here
> to avoid the package.json and the published version disagreeing).
> **Rollout:** clients that installed the updater lineage self-update
> on their next scheduled run or `applyr` launch; older installs
> update manually once (`bash scripts/install/update.sh`).
> **Browser extension:** unchanged in this build — `0.8.2` / `0.8.2a`.
> **Previous releases:** `0.8.4a`, `0.8.3a`, `0.8.2a`, `0.7.8a`, and
> `0.5.5a` — deep-dive notes live at this path under their git tags;
> the index is [`CHANGELOG.md`](./CHANGELOG.md).

## What's new in 0.8.041a

Hotfix — the `0.8.4a` restructure renamed this repo's own local clone
from `~/ares` to `~/applyr` as part of the GitHub rename, which
immediately broke the installed `applyr` command: the PATH wrapper
that `install.sh`/`install.ps1` generate bakes in the absolute install
path as plain text at install time, and had no way to notice the
directory had moved.

- **Fixed: the `applyr` PATH wrapper broke when the install directory
  was renamed or moved.** Both the Unix wrapper
  (`~/.local/bin/applyr`) and the Windows wrappers
  (`applyr.cmd`/`applyr.ps1`) now fall back through a short list of
  candidates — `$APPLYR_ROOT`, the originally recorded path,
  `$APPLYR_HOME`, `~/applyr`, and `~/ares` (covering this exact rename
  in either direction) — before failing with a clear, actionable
  message instead of a raw Node `MODULE_NOT_FOUND` stack trace.
  Verified with real tests: normal launch, both rename-fallback
  directions, and the total-failure error path all behave correctly.
  Anyone who already hit this needs to re-run the installer once to
  regenerate their wrapper with the new logic; every install from this
  point forward gets it automatically.

## What's new in 0.8.4a

Repo restructure — no product behavior changes beyond the fixes
below; existing installs update transparently.

- **Repository renamed `keshm2/ares` → `keshm2/applyr`** to match the
  product's actual name. Every hardcoded install/update URL updated
  (installer scripts, the TUI's bootstrap/version constants,
  `app/package.json`'s `repository.url`), plus the GitHub-tarball
  extracted-folder-name assumption in `docs/SETUP.md`'s
  manual-download instructions.
- **`scripts/` reorganized** from 26 flat files into `install/`,
  `runtime/`, `state/`, `jobs/`, `validate/` by concern (it had grown
  unmanageable — this reverses a deliberate 2026-07-09 decision to
  keep it flat, recorded in `docs/PLAN.md`). Every literal
  `scripts/<name>` invocation across the TUI, the browser extension,
  the three agent system prompts (regenerated into `.claude/agents/`
  and `.opencode/agents/`), this repo's own inter-script calls, and
  the docs was updated to match. Ten scripts that compute their own
  project root via `__file__`/`BASH_SOURCE` parent-directory
  arithmetic needed one more level of unwrapping now that they sit one
  directory deeper — verified end-to-end with a real `applyr status`
  run (loads actual historical data through the full subprocess
  chain) and the full conformance suite (13/13 PASS), not just static
  checks.
- **Removed the unimplemented root `resumes/` drop-folder.** Nothing
  in the codebase ever consumed it — `data/resumes/` is the real,
  load-bearing location (`resume-tailor.md` reads from it directly).
  Every installer/doc/uninstaller reference now points at
  `data/resumes/`, with the actual expected filenames (per role
  category) documented in `docs/SETUP.md`.
- **Fixed:** a hardcoded `/Users/keshmuthu/ares` absolute path baked
  into three `.claude/settings.local.json` Bash permission strings,
  and `scheduler.py`'s Linux advice message, which hardcoded "every
  30 min" regardless of `APPLYR_SCHEDULE_INTERVAL_SEC`.
- **Housekeeping:** purged 59MB of stale `logs/tmp/` scrape scratch,
  the orphaned `token-optimizer/` cache, and stale `.playwright-mcp/`
  session artifacts (all gitignored, no tracked-file impact); moved
  `system_architecture.md` into `docs/`; published the previously
  skipped `0.8.3-alpha.0` to npm and created its missing GitHub
  Release page.

## What's new in 0.8.3a

Installer-only bugfix release — no TUI, extension, or core behavior
changes.

- **Fixed: `install.ps1` "Unexpected token" parse errors on Windows.**
  The script had no BOM and used em-dashes in strings/comments.
  Windows PowerShell 5.1 (`powershell.exe`, the version that actually
  ships on Windows — not PS7's `pwsh.exe`) reads BOM-less `.ps1` files
  under the legacy ANSI codepage rather than UTF-8, which corrupted
  the em-dash bytes and broke the tokenizer, producing "Unexpected
  token" / "Missing closing '}'" errors that blocked the parse before
  a single line executed. Confirmed by round-tripping the file through
  cp1252 and reparsing with PowerShell's own AST parser, then fixed by
  replacing every em-dash with a plain ASCII hyphen.
- **Fixed: the installer one-liner couldn't self-heal.** Both
  `install.ps1` and `install.sh` skipped re-downloading the source
  tarball whenever an install already existed at `$target`
  (`AGENTS.md` present), so anyone who'd already hit the bug above —
  or any other stale/corrupted local copy — got stuck re-running the
  same broken script every time they retried `irm ... | iex` /
  `curl ... | bash`. Both installers now always re-fetch and overwrite
  the tracked source files before delegating to the local installer,
  even when one is already present. Gitignored local state
  (`config/*.json`, `data/`, `logs/`, `resumes/`, `docs/PLAN.md`)
  isn't part of the tarball, so it's never touched.

## What's new in 0.8.2a

- **Native Windows path completed.** The installer, updater, scheduler,
  runner, validator, uninstaller, and state append helper now have
  native PowerShell/Python paths instead of falling back to WSL/bash.
- **Browser extension works on native Windows installs.** The bridge now
  calls helpers through `sys.executable` and `append_state_entry.py`, and
  the extension UI/docs tell Windows users to start it with `py -3`.
- **TUI update prompt.** On app launch, when a newer version exists, the
  TUI shows a bottom-right install prompt with a purple-to-white wave
  outline and yes/no actions.
- **Banner glitch fixed.** The logo no longer sheds or gains ASCII blocks
  during navigation rerenders.

## What's new in 0.8.0a

- **Fixed: the Claude Code harness ran but applied to nothing.** A
  scheduled/background `claude -p` run is non-interactive, so Claude
  Code could not prompt for tool approval and declined every Bash
  call — read-only checks and the mandated state helpers alike — so
  the run reported "complete" having done no work. The runner now
  invokes claude with `--permission-mode bypassPermissions` (the
  analog of the Copilot branch's `--allow-all-tools`; override via
  `APPLYR_CLAUDE_PERMISSION_MODE`).
- **Node ≥ 22 is now required** (`engines`), matching the TUI's
  modern JS output.

## What this build is

`0.8.0a` carries the **distribution** story forward: install with one
command, stay current automatically, leave cleanly.

- **One-command install** — the cURL one-liner ends with a working
  `applyr` on your PATH; an npm-installed `applyr` with no core
  offers to download the core itself.
- **Automatic updates** — every scheduled run and `applyr` launch
  checks the `VERSION` file on GitHub `main` and self-updates
  (fail-open; `APPLYR_AUTO_UPDATE=0` opts out; `applyr update` runs
  one manually). Git checkouts fast-forward pull; archive installs
  overlay the tarball; per-user files are never touched.
- **Dedicated uninstall** — `applyr uninstall` /
  `bash scripts/uninstall.sh`: removes the schedule and the PATH
  wrapper, then deletes the install directory only after explicit
  confirmation (`--keep-data` / `--yes` variants). npm installs also
  run `npm uninstall -g @keshm/applyr`.
- **Phase 16 — multi coding-agent support** — Codex CLI and GitHub
  Copilot CLI adapters, 4-agent installer detection, the harness
  capability matrix with mandatory degraded paths in `AGENTS.md`, and
  the conformance suite (`scripts/run_conformance.py`; results in
  `docs/SETUP.md` §3.8).
- **README rewrite** — cut to ~a quarter of its length; phase
  planning and per-build inventories now live only in the docs.
- **Discord is optional** — the installer and `applyr setup` ask
  whether you want Discord status updates; opting in offers one
  channel for everything or separate channels per status (⚠ each
  channel needs its own webhook link). Opting out keeps every
  outcome local; the validator and reporter treat a disabled config
  as a clean skip, and legacy configs (no `enabled` field) keep
  working unchanged.

It also carries everything from the untagged `0.7.8a` follow-ups:
phase 9 (single-user structure review) and the TUI/setup work
documented in the changelog.

**applyr requires at least one supported coding agent** — Claude Code
or opencode (full capability), or Codex CLI / GitHub Copilot CLI
(API-boards degraded path).

## Install / update / uninstall

```bash
# install (one command; puts `applyr` on your PATH):
curl -fsSL https://raw.githubusercontent.com/keshm2/applyr/main/scripts/install.sh | bash

# or via npm:
npm install -g @keshm/applyr

# update now (also happens automatically on runs and launches):
applyr update

# uninstall:
applyr uninstall          # add --keep-data to keep config/data/resumes
```

## Verification

- Updater sandbox: tarball overlay 0.0.1 → test version with per-user
  files untouched; idempotent second run; dead-network `--auto` exits
  0; stale-lock reclaim; safe self-overwrite mid-run. Live end-to-end:
  a stale client pulled real GitHub `main` and self-updated.
- Uninstaller sandbox: `--keep-data` removes schedule + wrapper only;
  foreign-wrapper protection leaves other installs' commands alone;
  non-interactive without `--yes` never deletes data; `--yes` removes
  the install directory completely.
- Conformance: deterministic leg 13/13 PASS; harness legs opencode
  PASS and Claude Code PASS live; Codex/Copilot legs SKIP (CLIs not
  installed on the verification machine) — see `docs/SETUP.md` §3.8.
- `npm run typecheck` / `build` / `smoke` pass; `bash -n` clean on all
  shipped scripts; installer re-run is a no-op.

## Release artifacts

- Git tag `0.8.0a` on `main` — GitHub's automatic source archives are
  the manual-install path.
- npm: `@keshm/applyr@0.8.0-alpha.0` under the `alpha` dist-tag
  (`cd app && npm publish` — publishConfig sets `access: public` and
  the tag). Publish requires `npm login`.
- CI workflows (`.github/workflows/tui.yml`, `extension.yml`) run on
  the tag; no release-asset uploads are configured.

## Known gaps

- npm publish of `@keshm/applyr` awaits `npm login` on the
  maintainer's machine.
- Codex / Copilot live conformance runs pending a machine with those
  CLIs (`python3 scripts/run_conformance.py --harness all`).
- Phase 15 full-run parity check remains an operator action (the
  conformance harness legs are the first live signal).
- Phase 10 live in-browser autofill pass still pending.
- Workday is review-only by design.
- The sidebar greeting falls back to the `Test User` placeholder until
  setup writes a first name; there is still no account store.
