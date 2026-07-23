# Release notes — aplyx 0.9.8a

> **Build:** `0.9.8a` — alpha.
> **Branch:** `main`.
> **TUI in-app marker:** `packages/core/src/version.ts` →
> `BUILD_MARKER = "0.9.8a"` (re-exported from `app/src/theme.ts`,
> visible in the TUI side-panel footer, and also in the desktop app's
> Settings screen — one shared constant, both surfaces agree).
> **npm package:** `@keshm/aplyx` version `0.9.8-alpha.0`, published to
> the default `latest` dist-tag — `npm install -g @keshm/aplyx` gets it.
> The unscoped npm name `aplyx` belongs to an unrelated package — never
> `npm install aplyx`. If a re-publish is ever needed for this same
> build, the npm semver bumps to `alpha.1`/`alpha.2` while the
> human-facing build marker/git tag stay `0.9.8a`.
> **Rollout:** clients on the updater lineage self-update on their next
> scheduled run or `aplyx` launch; older installs update manually once
> (`bash scripts/install/update.sh` / `powershell scripts\install\
> update.ps1`).
> **Desktop app:** 0.1.0 internally (Tauri app version, not tied to the
> TUI's release cadence).
> **Browser extension:** unchanged in this build — `0.8.2` / `0.8.2a`.
> **Previous releases:** `0.9.75a`, `0.9.7a`, `0.9.1a`, `0.9.0a`,
> `0.8.43a`, `0.8.42a`, `0.8.041a`, `0.8.4a`, `0.8.3a`, `0.8.2a`,
> `0.7.8a`, and `0.5.5a` — deep-dive notes live at this path under
> their git tags; the index is [`CHANGELOG.md`](./CHANGELOG.md).

## What's new in 0.9.8a

This is a big one: a new shared job-postings cache backing search for
both UIs, a string of search-correctness fixes found while chasing
that work, pagination, and a desktop UI polish pass (smoother
transitions, a real dashboard, and a Profile settings screen).

### Shared job-postings cache (new backend)

Job search used to hit each company's live ATS API (Ashby/Lever/
Greenhouse/SmartRecruiters/Amazon/Oracle/Workday) directly on every
query — slow, and rate-limit-fragile. There's now a shared Supabase
`job_cache` table (public read, ~47 curated companies) refreshed
hourly by a new GitHub Actions workflow, with a per-company-capped
Postgres RPC (`job_cache_search`) so one high-volume company can't
starve the rest of a query's row budget — chunked upserts, retry
backoff, and I/O pacing tuned against Supabase free-tier limits
(`supabase/migrations/0003-0005`, `packages/core/src/jobCache.ts`,
`refreshJobCache.ts`, `.github/workflows/refresh-job-cache.yml`).
Auth/account storage stays on a separate Supabase project from the
job cache, decoupled so cache write volume can't affect account data.

### Search correctness fixes

Found and fixed while verifying the cache work, each confirmed live
against real queries:

- **Amazon dominated results, other sources rarely appeared.** A
  shared per-source deadline meant one slow source could starve the
  others out of a merged result set; deadlines are now decoupled per
  source.
- **Results were silently truncated below the configured page size**
  after the cache/pagination changes (`DEFAULT_PAGE_SIZE`/
  `MAX_PAGE_SIZE` raised, with live-source fetch limits for Amazon/
  Oracle/Workday decoupled from `pageSize` so raising it didn't
  regress those three).
- **A cache pre-filter bug excluded valid prefix matches** — "software
  engineering intern" and "software engineer intern" returned very
  different result counts for what should have been near-equivalent
  queries; root-caused to a bidirectional prefix-match bug in title
  filtering, fixed with one-directional prefix truncation
  (`looseTitleFilterWords()`).
- **The biggest one: search never actually covered the shared cache's
  full company list** — it only ever searched the user's own
  personally-configured targets, silently missing every company that
  was only present in the shared cache (e.g. SpaceX had real postings
  that never surfaced). `sharedCacheSlugs()` now returns the full
  shared list and search unions it with the user's personal targets.
- Cache silently dropped personally-configured companies not present
  in the shared list; narrow queries (e.g. "intern") returned
  near-zero results due to an overly tight per-company cap — both
  fixed with a conditional cap (tighter unfiltered, looser filtered).

### Pagination (both UIs)

Jobs search results are now paginated instead of dumping everything
into one list — defaults to 25 per page, user-configurable.
Desktop (`JobsScreen.tsx`): dropdown control, localStorage-persisted.
TUI (`SearchScreen.tsx`): `[`/`]` page keys, new `APLYX_RESULTS_PER_PAGE`
Settings field. The "preferred locations only" filter was taken
offline temporarily (desktop) while this landed — the underlying
search still covers the whole US either way.

### Desktop UI polish

- **Smoother route transitions.** Removed a redundant double-animation
  (every screen was fading itself in on top of the shell's own route
  transition); fixed an `onAnimationEnd` bug where a bubbled child
  animation event could end the route transition early or race a
  later one; added a safety-net timeout so the transition state
  machine can't get stuck; all six route chunks now prefetch shortly
  after the shell mounts so the first visit to a tab doesn't pop in
  un-animated while its chunk downloads.
- **Home is a fuller dashboard.** Added a "Recent activity" feed —
  applied jobs and pending review items merged into one
  reverse-chronological list — alongside the existing stat cards and
  next-action card.
- **New Profile settings page.** Every field from the onboarding
  wizard (all 8 pages — Basics, Contact, Location, Profiles, Work
  eligibility, Education, Demographics, Roles, Job targets) is now
  editable from Settings → Profile without re-running setup
  (`desktop/src/routes/shell/ProfileScreen.tsx`, reusing the existing
  `FieldInput`/`readProfileField`/`writeProfileField` plumbing).
- **Added a top-level error boundary.** The app previously had none —
  any uncaught render error anywhere unmounted the whole tree with no
  recovery. Found this the hard way: the new Recent-activity feed
  read a field (`date_applied`) that older `review_queue.json` entries
  don't have (they predate a field rename to `date_added`), which
  threw during sort and looked like the app hanging on the loading
  logo after "Run locally." Fixed the missing-field crash and added
  `ErrorBoundary` so any future render error shows a recoverable
  "Something went wrong / Reload" screen instead of an unrecoverable
  blank window.

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

- `tsc --noEmit` clean across `@aplyx/core`, `app`, and `desktop`.
- Search fixes verified live against real queries (not just unit-level)
  at each step — Amazon-domination, truncation, prefix-filter, and
  search-scope fixes were each reproduced first, then confirmed fixed
  against the live cache/API.
- Pagination verified live in both UIs — desktop via a browser-driven
  dev server, TUI via a real `tmux` session.
- Desktop UI polish verified live: route transitions clicked through
  all six tabs with zero console errors and no stuck transition state;
  the Recent-activity crash was reproduced against this machine's real
  `data/review_queue.json`, fixed, and re-verified in the rebuilt
  installed app.
- `npm run tauri build` produced a clean macOS release bundle; installed
  to `/Applications/aplyx.app`, launched, and confirmed running.
- Not exercised this pass: Linux/Windows desktop builds (unchanged from
  prior verification — see Known gaps).

## Release artifacts

- Git tag `v0.9.8a` on `main`.
- npm: `@keshm/aplyx@0.9.8-alpha.0` under the `latest` dist-tag
  (`cd app && npm publish` — `publishConfig` sets `access: public` and
  the tag). Publish requires `npm login`.
- CI workflow `.github/workflows/tui.yml` runs on every push touching
  the TUI/core. `.github/workflows/desktop-release.yml` builds and
  attaches desktop app bundles to a tagged release (triggered on `v*`
  tag pushes, or manually via `workflow_dispatch` for an existing tag).
  `.github/workflows/refresh-job-cache.yml` refreshes the shared job
  cache hourly (new this release).

## Known gaps

- Desktop app: the CI-built Linux and Windows bundles install correctly
  per the asset-matching logic but haven't been re-verified on real
  Linux/Windows hardware since 0.9.7a — only macOS was verified live
  this pass too.
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
- The "preferred locations only" filter is offline on desktop (see
  above) — pending a redesign now that pagination has landed.
- Current cache-covered internship inventory is genuinely sparse for
  some queries this time of year (verified by forensic tracing, not a
  bug) — the curated company list (`config/job_cache_targets.json`)
  could be expanded toward internship-heavy employers in a future
  build.
