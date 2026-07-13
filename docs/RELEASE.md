# Release notes — applyr 0.7.8a

> **Build:** `0.7.8a` — alpha.
> **Branch:** `main`.
> **TUI in-app marker:** `app/src/theme.ts` → `BUILD_MARKER = "0.7.8a"`
> (visible in the TUI side-panel footer).
> **npm package:** `@keshm2/applyr` version `0.7.8-alpha.0`, dist-tag
> `alpha`. The unscoped npm name `applyr` belongs to an unrelated
> package — never `npm install applyr`. npm requires strict semver, so
> `0.7.8a` is the human-facing marker and `0.7.8-alpha.0` its semver
> form.
> **Browser extension:** unchanged this build — stays at `0.5.5` /
> `0.5.5a`.
> **Previous release:** `0.5.5a` — its deep-dive notes live at this
> path under the `0.5.5a` git tag; the index is
> [`CHANGELOG.md`](./CHANGELOG.md).

## What this build is

`0.7.8a` is the **setup + TUI density** release. The installer now
takes a brand-new user from a single cURL command to a configured,
profile-filled setup; the TUI fills the terminal with two-pane
dashboard layouts instead of leaving half the screen empty; and the
macOS backspace bug in the TUI text inputs is fixed.

**applyr requires at least one of Claude Code or opencode installed** —
the installer detects which and asks when both are present.

## Install (three paths)

```bash
# 1. cURL one-liner — downloads into ~/applyr (APPLYR_HOME overrides):
curl -fsSL https://raw.githubusercontent.com/keshm2/ares/main/scripts/install.sh | bash

# 2. bash from a release archive:
curl -L -o applyr-0.7.8a.zip https://github.com/keshm2/ares/archive/refs/tags/0.7.8a.zip
unzip applyr-0.7.8a.zip && cd ares-0.7.8a && bash scripts/install.sh

# 3. npm (the TUI command; points at path 1 if no core is found):
npm install -g @keshm2/applyr@alpha
```

## What's new in 0.7.8a

### Setup overhaul

- **cURL bootstrap.** `scripts/install.sh` detects when it is piped
  (or run outside a checkout), downloads the source tarball into
  `~/applyr`, re-attaches stdin to the terminal, and re-runs itself
  from inside the tree. Non-destructive and idempotent, as before.
- **Profile prompts.** When `safe_fields.first_name` is still a
  placeholder and stdin is a TTY, the installer asks for first/last
  name, email, phone, LinkedIn, GitHub, and graduation date, and
  writes them to `config/targets.json` atomically via `jq`
  (bash-3.2-safe). A bold-cyan notice states that everything entered
  is **kept locally only** — gitignored, never committed, uploaded,
  or shared. `applyr setup` shows the same notice.
- **`resumes/` drop-folder.** Created (and gitignored) at the project
  root by both the installer and the wizard, with instructions to
  drop **all resumes as PDFs** so the agent can scan and convert each
  to markdown for per-job tailoring.
- **npm fallback UX.** A globally npm-installed `applyr` run outside
  any core checkout prints the one-line core installer and the
  `APPLYR_HOME` / `APPLYR_ROOT` hints instead of a stack trace.

### TUI density redesign

Operator-approved layouts (two-pane browser, cockpit, dashboard
panels, rules+columns style) targeting ~75% screen fill:

- **Shared pane primitives** — `app/src/ui/Pane.tsx` (`paneLayout`,
  `DetailPane`, `PaneRow`, `PaneRule`). Panes activate when the
  content band is ≥ 76 columns; every screen degrades to its previous
  stacked layout below that.
- **Jobs — MANUAL:** results list left; full-height right pane with
  source, location, url, fit verdict + reasoning (or a "press f"
  nudge), and an actions footer.
- **Jobs — AUTO cockpit:** tier-colored cap gauge (`████░░ n/25`),
  prompt line, heartbeat outcome counters (applied / review /
  failed / unfit), elapsed run clock in the title, and a log tail
  that fills every remaining row (200-line buffer) instead of a
  fixed 12.
- **Review / History:** list + detail pane (state, ats, resume, url,
  reasoning; History adds all-time totals).
- **Status:** stats left, full-height recent-activity pane right.
- **Cap tiers re-cut:** 25 = MAX with a **rainbow gauge**, 22–24 =
  `heavy+` (new hot red `#FF3B30`), 17–21 = `heavy` (yellow), 6–16
  standard, 1–5 light.
- **Sidebar:** randomized per-launch greeting (Hello / Welcome /
  Nice to see you / Hey there) over the user's first name in rainbow
  (read from `safe_fields`, placeholder until setup); new Screen /
  Failed / Seen / Sched rows; local **12-hour clock with time-zone
  abbreviation**.
- **Navigation:** `esc` returns to the `> [x]` welcome menu from any
  screen — it never quits, and it is locked while a run is live.

### Fixes

- **macOS backspace.** The Backspace key sends DEL (0x7f), which Ink
  reports as `key.delete`; the TUI editors treated that as
  forward-delete — a no-op at the end of the line, so backspace
  appeared dead. Backspace and delete now both erase backward in the
  search query, cap, and prompt editors.
- **Resize invariants.** Welcome menu sheds its intro, description,
  state, and footer bands as rows shrink so the options are never
  clipped; option rows truncate instead of wrapping; `MIN_COLUMNS`
  40 → 44 (the tab row with the Review "(n)" badge wrapped at 40 and
  corrupted the pinned frame); sidebar threshold 64 → 72 columns;
  the content band has an explicit width and a non-shrinking
  sidebar, so wide nested rows can no longer squeeze the sidebar.

## Verification

- `npm run typecheck`, `npm run build`, `npm run smoke` all pass.
- Piped full-app frames verified at 44×12 through 120×40 (stacked and
  two-pane variants, welcome / review / history), plus standalone
  renders of the search, cockpit, and status screens.
- Installer: `bash -n` clean; non-interactive re-run in a configured
  repo is a no-op (exit 0); profile prompts + `jq` write verified in
  a sandbox; `capTier` boundaries unit-checked (16 standard /
  17 heavy / 22 heavy+ / 25 MAX).

## Release artifacts

- Git tag `0.7.8a` on `main` — GitHub's automatic
  "Source code (zip)" / "Source code (tar.gz)" assets are the bash
  install path.
- npm: `@keshm2/applyr@0.7.8-alpha.0` under the `alpha` dist-tag
  (`cd app && npm publish` — publishConfig already sets
  `access: public` and the tag).
- The two CI workflows (`.github/workflows/tui.yml`,
  `.github/workflows/extension.yml`) run on the tag; no release-asset
  uploads are configured.

## Known gaps (unchanged unless noted)

- Phase 9 (migration-friendliness review) is planned, not done.
- Phase 13: npm publication ships with this build
  (`@keshm2/applyr`); provider-setup and hosted storage remain
  deferred.
- Phase 15: live opencode ↔ Claude Code parity run still pending.
- Phase 16 (Codex, GitHub Copilot) is planned.
- Workday is review-only by design.
- The sidebar greeting falls back to the `Test User` placeholder
  until setup writes a first name; there is still no account store.
