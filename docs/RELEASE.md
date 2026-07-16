# Release notes — applyr 0.9.0a

> **Build:** `0.9.0a` — alpha.
> **Branch:** `main`.
> **TUI in-app marker:** `app/src/theme.ts` → `BUILD_MARKER = "0.9.0a"`
> (visible in the TUI side-panel footer).
> **npm package:** `@keshm/applyr` version `0.9.0-alpha.2`, published
> to the default `latest` dist-tag — `npm install -g @keshm/applyr`
> gets it. The unscoped npm name `applyr` belongs to an unrelated
> package — never `npm install applyr`. `0.9.0-alpha.0`/`alpha.1` were
> published first, then superseded (npm won't let a version's contents
> be overwritten in place, so the npm semver keeps bumping while the
> human-facing build marker/git tag stay `0.9.0a` — same divergence as
> `0.8.041a`'s `0.8.41-alpha.0`). Anyone who installed before this gets
> the fix on their next `applyr update`/launch.
> **Rollout:** clients that installed the updater lineage self-update
> on their next scheduled run or `applyr` launch; older installs
> update manually once (`bash scripts/install/update.sh` /
> `powershell scripts\install\update.ps1`).
> **Browser extension:** unchanged in this build — `0.8.2` / `0.8.2a`.
> **Previous releases:** `0.8.43a`, `0.8.42a`, `0.8.041a`, `0.8.4a`,
> `0.8.3a`, `0.8.2a`, `0.7.8a`, and `0.5.5a` — deep-dive notes live at
> this path under their git tags; the index is
> [`CHANGELOG.md`](./CHANGELOG.md).

## What's new in 0.9.0a

### Guided first-run onboarding wizard

Replaces the old readline-based `wizard.ts` prompt sequence with a full
Ink UI (`app/src/ui/onboarding/`): a multi-page, multi-field form
(Basics → Contact → Location → Profiles → Work eligibility →
Demographics → Roles → Job targets → Resumes) with `Tab`/`Shift+Tab`
between fields on a page and `Shift+←/→` between pages, live
autocomplete for home location and target companies, a skip-to-defaults
flow for roles/locations/companies, and a percentage progress bar in a
dedicated sidebar (`OnboardingSidePanel`) instead of the normal
stats panel. Every field commits to `config/targets.json` immediately
(not just at the end), so quitting mid-wizard and relaunching resumes
exactly where you left off — `_onboarding.current_page` and
`_onboarding.committed_fields` drive both the resume point and the
live percentage. `applyr` auto-launches the wizard on a fresh install
or an incomplete one; `<App>` (and its own welcome screen) never mounts
until the wizard finishes.

- **LinkedIn/GitHub now store as a bare username**
  (`linkedin_username`/`github_username`), not a full URL — a new
  `app/src/profileLinks.ts` normalizes either shape on read, so an
  existing config with the old `linkedin_url`/`github_url` keeps
  working with zero manual migration; the browser extension bridge
  (`scripts/runtime/extension_bridge.py`) derives the full URL back out
  at its API boundary, so `extension/` needed no changes.
- **Settings screen expanded**: a new "Company targets" section makes
  `role_keywords`/`level_keywords`/`season_keywords`/
  `preferred_locations`/`ashby_company_slugs`/`lever_company_slugs`/
  `workday_tenants` live-editable (previously hand-edit-`targets.json`-
  only); Personal info gained `location`, `zip_code`, `address_line1`,
  `address_line2`, `ethnicity`, `hispanic_or_latino`, `date_of_birth`.
- **npm bootstrap no longer asks "install core now? [Y/n]"** — it just
  installs, with a `--no-core` / `APPLYR_SKIP_CORE=1` opt-out for
  advanced users who want to skip it.
- **Resumes**: converting an arbitrarily-named PDF now asks for a short
  description, recorded in a new gitignored
  `data/resumes/.resume_meta.json` sidecar and shown in the Resumes tab.
- **`docs/SETUP.md` trimmed** from ~700 lines to point at the wizard +
  Settings + `targets.example.json`'s new inline `_help` notes instead
  of walking through every field by hand.

### Jobs manual search — overhauled

- **Greenhouse joins Ashby/Lever/Workday** as a 4th toggleable source —
  each is now a real `[x]`/`[✓]` checkbox (press `t` to focus the row,
  `←/→` to move, `enter`/`space` to toggle), not read-only status text.
- **Results table redesigned** into fixed, independently-truncating
  columns (Company/Title/Posted/Location/Fit) so a long title can never
  overrun the columns after it — the previous single-line-truncate
  design let exactly that happen.
- **Posted-date column and default recency sort**: `Xh ago` under a
  day, `Xd ago` through 5 days, then a plain `mm/dd` (table) or full
  `mm/dd/yyyy` (detail pane) beyond that. Results always sort
  most-recent-first (`sortByPostedDesc` in `app/src/jobs.ts`) —
  previously unsorted/source-order.
- **Results capped to postings from the last 6 months** — old, likely-
  filled listings no longer crowd out fresh ones (jobs with no
  parseable posted date are kept, not dropped, since missing data isn't
  evidence of staleness).
- **Configurable results-per-page**: Settings → Environment →
  "Jobs per page" (`APPLYR_JOBS_PER_PAGE`), 10-75, default 50 — the
  same tiered-color warning style as the run screen's session-cap
  picker, with a rainbow "will slow down your search" warning at 75.
- **Fixed: a fuzzy-matching regression let non-intern postings through
  an "intern" query** (e.g. "Internal Tools", "International" — a
  subsequence/substring scorer only needs "intern"'s letters to appear
  in order, and both those words start with them). Title matching is
  back to precise per-word matching, with "intern" specifically
  matched as a whole word (`intern`/`interns`/`internship`/
  `internships`) so it can never match as a prefix of an unrelated word.
- **Board-failure messages now name the failing slug(s)** instead of a
  bare count (`"1/8 failed: acme-co"` vs `"1/8 boards failed"`), and
  fetches retry once after a short pause before giving up — most
  transient concurrent-fetch failures now resolve silently.
- **Detail pane now shows company/source/location/posted-date plus the
  fit gate** (previously missing the posted date and the plain company
  name); the narrow-terminal fallback view got the same fields and no
  longer requires a fit check to show anything.
- **Sidebar decluttered**: the greeting/name/clock moved to the app
  header (visible on every tab now, not just when the sidebar showed),
  and the sidebar itself is hidden on the Jobs tab so the results table
  gets the full terminal width instead of fighting a fixed side column.
- **Settings' Personal info values right-aligned** into a clean column
  instead of packed immediately after each label.

### Fit gate

- **Preferred location is now a soft preference, not a status gate** —
  `evaluate_job_fit.py` splits its running total into `core_score`
  (role/level/skills/years/degree — the only thing status thresholds
  gate on) and a separately-reported `fit_score`
  (`core_score + location_points` — display/sort only). A strong
  candidate in a non-preferred location is no longer demoted, and a
  weak one is no longer promoted purely by a location bonus.
  `DECISION_VERSION` moved `phase4-v3` → `phase4-v4`; conformance
  goldens re-pinned in `scripts/validate/run_conformance.py`.

### Fixed — Windows installer

- **The one-line Windows installer (`irm ... | iex`) was broken on a
  genuinely fresh machine.** After bootstrapping (downloading and
  unpacking the source tarball), `install.ps1` re-invoked itself at
  `scripts\install.ps1` — missing the `install\` subdirectory the
  earlier `0.8.4a` reorg moved it into — so the re-exec failed to find
  the file. Fixed to `scripts\install\install.ps1`, matching the bash
  installer's already-correct equivalent.

### Fixed — resume step felt mandatory, installers hard-failed on missing tools

- **The onboarding wizard's resume step wasn't actually mandatory, but
  felt like it.** `Enter` — the "commit & advance" key on every other
  page — is intercepted on this one page by the embedded Resumes
  screen for a different purpose (convert the selected file / show a
  status message), so the one key every other page trained you to
  press does nothing that reads as "next." The actual skip (Shift+→)
  was buried in a generic "prev/next page" hint. Fixed: the step's own
  text now spells out both choices explicitly ("press `o` to open the
  folder... or `esc`/`shift+→` to skip"), `Escape` now also skips this
  one step (a more guessable second key), and the footer hint says
  "skip for now" instead of "prev/next page." Opening the resumes
  folder cross-platform (`o`) already worked — it just wasn't visible
  enough to notice.
- **Installers no longer hard-fail the moment `jq`/`python3`/`pypdf`
  is missing.** Both `install.sh` and `install.ps1` now detect
  everything missing up front, print one combined "not detected, and
  needed to continue" message, and ask once: yes attempts to install
  everything (brew/apt/dnf/yum/pacman/apk on POSIX, winget for Python
  on Windows, `pip install --user` for `pypdf`) before continuing; no
  prints that the install can't proceed without them and exits. `pypdf`
  (from `requirements.txt`) is checked because resume PDF conversion
  silently doesn't work without it, and nothing previously installed
  it automatically.
- **Fixed: the Windows installer could crash outright while checking
  for `pypdf`** — the exact condition it exists to detect. On
  PowerShell 7.3+ with `$PSNativeCommandUseErrorActionPreference` on
  (increasingly the default), a native command's non-zero exit under
  `$ErrorActionPreference = "Stop"` throws instead of just setting
  `$LASTEXITCODE`; the `import pypdf` probe (and the new winget/pip
  install calls) had no `try`/`catch` around them, unlike this file's
  own established `Find-Python` pattern. A user with no `pypdf`
  installed — normal on a fresh machine — could hit an unhandled
  exception instead of the intended "not detected, install it?"
  prompt. All three new native-command calls now wrap the same way
  `Find-Python` already does.

### Verification

- `npm run typecheck` / `build` / `smoke` and the deterministic
  conformance leg (`python3 scripts/validate/run_conformance.py`,
  13/13 PASS) all pass on the full tree.
- `bash -n` clean on every shipped `.sh` script; every `.ps1` file
  checked for the em-dash/BOM class of bug from `0.8.3a` (none found).
- Cross-checked every literal `scripts/...`/`scripts\...` path
  reference in `install.sh`/`install.ps1`/`update.py`/`uninstall.py`/
  `scheduler.py` against what actually exists on disk — the Windows
  installer bug above was the only mismatch found.
- Confirmed `fetch_workday_listings.py`'s new `posted_at` field is
  optional/additive and inert to `job_state.py canonicalize` and
  `evaluate_job_fit.py` (both read named fields explicitly and ignore
  anything else); confirmed the TUI's manual-search `jobs.ts` has zero
  callers outside `app/` — the automatic pipeline's own job discovery
  (driven by `agents/bodies/job-scraper.md`) is unrelated and unaffected.
- Bash side of the new dependency-detection flow verified in isolation
  (yes/no/blank-default-yes branching against simulated missing
  binaries). PTY-verified the resume step's new Escape-skip and folder-
  open wording in a fresh scratch install.
- **Not independently re-verified this release**: a live automatic
  run (would submit real applications), a real install on a physical
  Windows/Linux machine, and `install.ps1`'s syntax (no `pwsh` on this
  machine to parse-check it — written by mirroring the file's existing
  `Find-Python`/`Read-Host`/`Fail` patterns exactly). The installer/
  pipeline checks above are static (path/syntax/schema) verification,
  not an end-to-end live run. `generate_agent_definitions.py --check`
  reports no drift between `agents/bodies/` and the generated
  per-harness copies.

## What's new in 0.8.43a

- **The live-run screen has its own UI.** Starting an automatic run now
  shows a phase checklist (Scrape → Fit-gate → Tailor → Apply → Report)
  with an animated progress bar, instead of the same cockpit view used
  when idle. The job-scraper agent now prints explicit progress markers
  at each phase boundary and one `[apply] <title> @ <company>` line per
  application attempt (see `agents/bodies/job-scraper.md`'s "Progress
  markers" section) — previously nothing drove this UI on a real run, so
  the checklist and progress bar never actually activated outside a
  hand-crafted test. The screen now also shows which company and role
  is currently being applied to, live.
- **Stop and correct a run in progress.** `x` arms a stop (press again
  to confirm — a stray keystroke can't kill a run); `c` on the confirm
  prompt instead lets you type a correction (e.g. "only apply to IC
  roles, not manager positions"), which stops the run cleanly and
  restarts it with that instruction folded in. Neither fires while
  you're typing in a text field. `run_job_agent.py` now installs a real
  SIGTERM/SIGINT handler that kills the whole harness process group
  (POSIX) so stop actually stops everything it spawned, not just the
  direct child; the Windows TUI path uses `taskkill /T /F` instead,
  since Windows has no equivalent signal delivery.
- **Fixed: fast-failing runs left the screen stuck on "waiting for
  session log…"** with no way to see why short of leaving the TUI. The
  log tail is now read synchronously the moment a run's process closes,
  not only via the 1-second poll that a run finishing in under a second
  could outrun entirely.
- **The `needs_review` fit-score floor moved from 45 to 70** — fewer
  borderline jobs land in your review queue; `evaluate_job_fit.py`'s
  `decision_version` moved to `phase4-v3` to match.
  Discord notifications and the review queue / history screens now
  send the direct application-form link (`apply_url`) instead of the
  generic job-listing link, so clicking through from a notification
  lands you on the actual form.
- **"AUTO" sparkles** — animates through a purple → white blend (the
  same two colors as the update-prompt box's traveling ring) everywhere
  it appears: the mode indicator and the sidebar's Mode row. An earlier
  version of this animation cycled through the banner's full violet →
  maroon palette, which read as "too much red" and could show a stray
  green/blue tint at the wrap-around seam between maroon and violet —
  fixed by dropping to the two-color purple/white blend and switching
  the gradient interpolation from a circular wrap to a ping-pong
  reflection, which by construction never interpolates between two
  non-adjacent colors.
- **A cycling activity glyph** (`.` → `·` → `•` → `*`, Claude-Code-style)
  now marks the running-status title and the current phase's checklist
  bullet, so a live run visibly signals "still working" even during a
  long silent stretch (e.g. a slow board fetch) instead of relying on
  the elapsed clock alone.

## What's new in 0.8.42a

- **Resumes screen** — a 6th TUI tab (`applyr resumes`, or pick it from
  the welcome menu). Shows all 6 filenames `resume-tailor.md` actually
  reads (`base_resume_swe`, `_ai_ml`, `_cyber`, `_networking_cyber`,
  `_balanced`, `base_cover_letter`), each marked ready / needs
  conversion / not added yet. `o` opens `data/resumes/` directly in
  Finder/Explorer/xdg-open — no more guessing where applyr expects
  resumes to live. `c` converts a PDF that's missing its markdown
  counterpart on the spot, via the new `scripts/state/convert_resume.py`
  (real `pypdf` text extraction, now declared in `requirements.txt`) —
  no more silently-unusable resumes because the tailoring agent only
  reads `.md`. A `(N)` badge on the tab bar surfaces pending
  conversions, matching the existing Review badge.

### Fixed — read this if you have an existing schedule from before 0.8.4a

Auto-update could silently strand an already-installed launchd/schtasks
schedule on a stale script path. The `0.8.4a` `scripts/` reorg was the
first update to ever relocate the runner script itself; the
tarball-overlay updater adds/overwrites files but never deletes old
ones, so a schedule entry written before that reorg kept invoking the
old flat `scripts/run_job_agent.sh` forever — `VERSION` correctly
reported the current build, but the *scheduled* pipeline silently
never picked up anything shipped after 0.8.4a. (The interactive TUI
was never affected — `applyr` always rebuilds fresh from source on
every update.)

`update.py` now re-runs `scheduler.py install` (fully idempotent —
identical content when nothing changed) after every successful update
whenever a schedule is already present, so this class of bug can't
recur for anyone past this release.

**One-time fix if you're currently affected:** run `applyr` once and
accept the update prompt (this alone refreshes the schedule going
forward), or simply `applyr uninstall` and reinstall.

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
