# Release notes — aplyx 0.9.75a

> **Build:** `0.9.75a` — alpha.
> **Branch:** `main`.
> **TUI in-app marker:** `packages/core/src/version.ts` →
> `BUILD_MARKER = "0.9.75a"` (re-exported from `app/src/theme.ts`,
> visible in the TUI side-panel footer, and also in the desktop app's
> Settings screen — one shared constant, both surfaces agree).
> **npm package:** `@keshm/aplyx` version `0.9.75-alpha.0`, published to
> the default `latest` dist-tag — `npm install -g @keshm/aplyx` gets it.
> The unscoped npm name `aplyx` belongs to an unrelated package — never
> `npm install aplyx`. If a re-publish is ever needed for this same
> build, the npm semver bumps to `alpha.1`/`alpha.2` while the
> human-facing build marker/git tag stay `0.9.75a`.
> **Rollout:** clients on the updater lineage self-update on their next
> scheduled run or `aplyx` launch; older installs update manually once
> (`bash scripts/install/update.sh` / `powershell scripts\install\
> update.ps1`).
> **Desktop app:** 0.1.0 internally (Tauri app version, not tied to the
> TUI's release cadence) — this release is desktop-only UI/theming work,
> shipped alongside the TUI's version bump for one shared build marker.
> **Browser extension:** unchanged in this build — `0.8.2` / `0.8.2a`.
> **Previous releases:** `0.9.7a`, `0.9.1a`, `0.9.0a`, `0.8.43a`,
> `0.8.42a`, `0.8.041a`, `0.8.4a`, `0.8.3a`, `0.8.2a`, `0.7.8a`, and
> `0.5.5a` — deep-dive notes live at this path under their git tags; the
> index is [`CHANGELOG.md`](./CHANGELOG.md).

## What's new in 0.9.75a

This build is desktop app UI/theming work only — no TUI, backend, or
job-agent behavior changed. It closes out **Phase 14C (Desktop UI
refinement and theming)** end to end.

### Home dashboard + per-screen polish

- **Home** now reads as a real dashboard: stat cards (applications sent,
  waiting in review, jobs seen) plus a single derived "next action" card
  instead of a flat checklist (`desktop/src/routes/shell/HomeScreen.tsx`/
  `.css`).
- **Resumes** moved from a flat list with inline convert buttons to the
  same list+detail split Jobs/Review/History already use
  (`ResumesScreen.tsx`).
- **Review** and **History** now auto-advance to the first pending /
  newest item on load (and after an action resolves one) instead of
  landing on a blank detail pane that has to be re-clicked into.

### 4-family theme system

Settings → Appearance now has a theme-family picker independent of
light/dark/system mode (`desktop/src/styles/tokens.css`,
`desktop/src/lib/uiPrefs.ts`):

- **Calm Cobalt** (new default) — cool blue-tinted neutrals, cobalt
  accent.
- **Sage Slate** — quieter, softer, less saturated green-gray accent.
- **Aplyx Classic** — the original warm beige + violet/plum look,
  preserved verbatim, still selectable.
- **Graphite Cyan** — darker, more technical, ops-console feeling.

Every family carries the full token contract (`--ground`/`--surface`/
`--text`/`--accent`/etc.) so no component ever reads a family's hex
directly; status colors (good/warn/danger) stay identical and separate
from accent across all four.

### Three more bundled fonts

Alongside the existing System/Geist choice, Settings now also offers:

- **Inter** — dense/tabular product UI.
- **IBM Plex Sans**, paired with **IBM Plex Mono** — enterprise,
  analytical tone.
- **Atkinson Hyperlegible Next** — accessibility- and readability-first.

All OFL-licensed, self-hosted via `@fontsource`/`@fontsource-variable`
(latin-subset variable woff2 in `desktop/src/assets/fonts/`, no CDN
fetch, works fully offline) — same pattern the existing Geist option
already used. System stays the default; this only adds choices.

### Fixed

- **The nav rail — and every other in-app link — rendered with the
  browser-default underline.** No stylesheet anywhere reset
  `text-decoration` on `<a>`, which undercut the "premium app rail" look
  this phase is about. Fixed globally: `text-decoration: none` added to
  the shared `a` rule in `desktop/src/styles/base.css`.

## Install / update / uninstall

```bash
# install (one command; puts `aplyx` on your PATH):
curl -fsSL https://raw.githubusercontent.com/keshm2/aplyx/main/scripts/install/install.sh | bash

# or via npm:
npm install -g @keshm/aplyx

# optionally also install the desktop app:
bash scripts/install/install_desktop.sh        # macOS / Linux
powershell -ExecutionPolicy Bypass -File scripts\install\install_desktop.ps1   # Windows

# update now (also happens automatically on runs and launches):
aplyx update

# uninstall (removes the desktop app too, if installed):
aplyx uninstall          # add --keep-data to keep config/data/resumes
```

Windows: `powershell -ExecutionPolicy Bypass -File scripts\install\install.ps1`
(or `irm .../install.ps1 | iex`), native PowerShell, no WSL.

## Verification

- `tsc --noEmit` (desktop) and `npm run build` (desktop, `tsc && vite
  build`) both clean; all six bundled font files (Geist, Geist Mono,
  Inter, IBM Plex Sans, IBM Plex Mono, Atkinson Hyperlegible Next) hash
  and bundle correctly in the production build.
- All four theme families verified live across light and dark by
  driving the actual `npm run dev` build in a browser and switching
  between them; all four font options verified the same way.
- Found and fixed the link-underline bug by visually inspecting the nav
  rail in that same live session — not caught by typechecking.
- `npm run tauri build` produced a clean macOS release bundle; installed
  to `/Applications/aplyx.app`, launched, and confirmed running.
- Not exercised this pass: Linux/Windows desktop builds (unchanged from
  0.9.7a's verification — see Known gaps), and the TUI itself (`app/`),
  since this release doesn't touch TUI code.

## Release artifacts

- Git tag `v0.9.75a` on `main`.
- npm: `@keshm/aplyx@0.9.75-alpha.0` under the `latest` dist-tag
  (`cd app && npm publish` — `publishConfig` sets `access: public` and
  the tag). Publish requires `npm login`.
- CI workflow `.github/workflows/tui.yml` runs on every push touching
  the TUI/core. `.github/workflows/desktop-release.yml` builds and
  attaches desktop app bundles to a tagged release (triggered on `v*`
  tag pushes, or manually via `workflow_dispatch` for an existing tag).

## Known gaps

- Desktop app: the CI-built Linux and Windows bundles install correctly
  per the asset-matching logic (verified against the live release data
  as of 0.9.7a) but haven't been re-verified on real Linux/Windows
  hardware since — only macOS was verified live this pass too.
- Desktop app: hosted↔local pipeline-state sync doesn't exist yet —
  `SupabaseAdapter.loadState()` returns `undefined`.
- Hosted sign-up email delivery depends on the operator configuring
  custom SMTP (Supabase's built-in mailer is rate-limited/unreliable) —
  not yet done on the live project.
- Google OAuth sign-in needs a Google Cloud OAuth client configured in
  the Supabase dashboard — not yet done on the live project.
- Codex / Copilot live conformance runs still pending a machine with
  those CLIs.
- Workday remains review-only by design.
- Font/typography direction (Phase 14C Priority 4) is now shipped, but
  only the four families listed above — no per-density or per-locale
  font tuning beyond that.
