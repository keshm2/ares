# aplyx — Job Application Agent — Core Rules

## Phase status (keep in sync with docs/PLAN.md's Phase Status Pointer)
- **Desktop app search smoothness + motion polish (2026-07-22,
  operator-reported: the Mac app still "takes a few seconds" and feels
  laggy/abrupt).** The remaining problem was no longer raw fetch time
  alone — after the 2026-07-21 search-latency fix, the desktop app still
  *felt* slow because it held all results until the slowest sources
  finished and hard-swapped major UI regions with no transitions. Two
  concrete fixes landed:
  1. **Perceived search latency reduced with a two-phase desktop search**
     in `desktop/src/routes/shell/JobsScreen.tsx`. Fast sources
     (Ashby/Lever/Greenhouse/SmartRecruiters) now render first, then the
     complete set replaces them once the slower Python-backed sources
     (Amazon/Oracle/Workday) finish. This required no fork of the core
     dedup/sort logic — the desktop screen simply calls the existing
     `searchJobs(root, query, sources)` twice with source subsets. The
     same patch also fixed stale-result races with a generation counter
     and cached the resolved local root for the lifetime of the screen so
     repeated search/fit/save actions don't keep re-awaiting `findRoot()`.
  2. **Desktop motion/system polish** using the existing motion tokens in
     `desktop/src/styles/tokens.css`: the first pass added entrance motion,
     but that still *felt* static because routes hard-swapped. The current
     fix is a real shell-level transition in `AppShell.tsx` — the previous
     route animates out, the next route animates in, and the main column
     holds its shape during lazy chunk loads via `.shell-route-fallback`.
     On top of that, shell screens still mount with a subtle
     `aplyx-fade-rise`; detail panes and local-home stats fade in; wizard
     steps animate on step changes via `WizardShell.tsx`; and the shared
     `desktop/src/styles/motion.css` centralizes those classes. The goal
     was smoother, calmer transitions without making the app feel slower.
  3. **Bridge/runtime tightening**: `packages/core/src/bridge.ts`
     extracted an `exitWith()` helper so the child still hard-exits after
     stdout is written (preserving the straggler-kill behavior required
     by `withDeadline()`), but now has a short fallback timer in case a
     broken pipe prevents the callback from firing. On the Rust side,
     `desktop/src-tauri/src/lib.rs` now caches the resolved Node binary
     path and bundled `bridge.js` path with `OnceLock`, removing repeated
     filesystem probing on every bridge command.
  **Verified:** `npm run typecheck`/`build` for both `app/` and
  `desktop/`, `cargo check` in `desktop/src-tauri/`. **Not verified:**
  perceived smoothness in a live Tauri window or on real Windows/Linux
  machines — the desktop app still cannot be GUI-driven from this
  session, so the motion/search improvements are code- and build-verified
  rather than hand-felt here.

- **Desktop app general lag/loading-time fix (2026-07-21, operator-
  reported: "it still lags my desktop application... account for other
  platforms as well").** Broader than the search-latency fix above (same
  day, earlier). Two real issues found:
  1. **Every debug build installed to `/Applications/aplyx.app` this
     session was an unoptimized Rust `--debug` build (33MB binary), not
     the `--release` build (11MB) a real install actually ships** —
     `scripts/install/install_desktop.sh`/`.ps1` and the CI-built
     prebuilt release pipeline (`.github/workflows/desktop-release.yml`,
     via `tauri-apps/tauri-action`'s default) were already correctly
     building release on all three platforms; this was purely an
     artifact of using `--debug` for fast local iteration during this
     session's testing, not a real product defect. Fixed going forward
     by rebuilding and reinstalling in `--release` mode — this alone is
     a well-established, large, cross-platform win (optimized code
     paths, no debug-assertion overhead), not something specific to
     macOS.
  2. **The entire app — every route, both onboarding wizards, all six
     `AppShell` screens — was one eagerly-bundled ~500KB JS chunk**,
     parsed in full before the window could render anything, even
     though a fresh launch only ever needs `EntryScreen` first. This
     hits every platform, and hits harder on weaker WebView engines than
     macOS's WKWebView (Windows WebView2, and especially Linux's
     WebKitGTK). Fixed with route-level code-splitting: `App.tsx`'s
     `AuthScreen`/`LocalWizard`/`HostedWizard`/`AppShell` and
     `AppShell.tsx`'s six screens (`HomeScreen`/`JobsScreen`/
     `ReviewScreen`/`HistoryScreen`/`ResumesScreen`/`SettingsScreen`) now
     load via `React.lazy()` + `Suspense`, each becoming its own small
     chunk (1.7-10KB) fetched only when actually navigated to, instead
     of all being parsed upfront. Verified via the real Vite build
     output: the previously-monolithic bundle split into a ~447KB
     always-needed chunk (React/react-router/Supabase SDK/AuthContext —
     needed on every launch regardless of route, since session-restore
     has to run even for local-only users) plus 11 small per-route
     chunks.
  **Considered but not done this pass:** lazy-loading `@supabase/
  supabase-js` itself out of the always-needed chunk (it's a real
  contributor to that remaining ~447KB, confirmed via its ~724KB
  unminified source size) — deferred because `AuthContext`'s session-
  restore-on-launch logic is exactly the kind of already-debugged-twice
  fragile subsystem (see the two bugs found immediately after Phase 14B
  shipped) that shouldn't be touched without the ability to actually
  click through the auth flow in a live window, which this session still
  can't do. Flagging it as the next lever if further startup-weight
  reduction is wanted.
  **Verified:** clean typecheck/build across TUI/core/desktop(TS+Vite+
  Rust `--release`)/extension; the real Vite chunk breakdown (above);
  the search-latency fix from earlier the same day re-measured
  unaffected (2.2-2.6s across 3 runs) after these changes. **Not
  verified:** actual perceived launch/navigation smoothness in a live
  window (no GUI-driving capability in this session) or on a real
  Windows/Linux machine (none available here) — the fixes applied
  (release-mode builds, route-based code-splitting) are platform-
  agnostic by construction, but a real pass on both remaining platforms
  is still worth doing before calling this closed.

- **Search latency fix (2026-07-21, operator-reported: "sometimes very
  very slow").** Manual search (`packages/core/src/jobs.ts`'s
  `searchJobs()`, used by both the TUI and desktop) ran all sources
  concurrently already, but three real bugs made the overall time
  unbounded and, for the newest sources, routinely slow:
  1. **SmartRecruiters ignored the search query at the API level** and
     paginated every configured company up to its 500-posting cap
     regardless of the query — measured live at **2.9s** just for this
     one source (Dominos alone lists 24k+ postings). Fixed: the API
     supports server-side `q=` keyword filtering (confirmed live) — now
     passed through from both the manual-search path and the automated
     agent's `fetch_smartrecruiters_listings.py` (`--search`). Same fix
     brought this down to well under 1s in testing.
  2. **Oracle's list request used an unnecessarily small page size**
     (25, copied from the careers.oracle.com UI's own choice, not an
     API-enforced cap — confirmed live that the API accepts at least
     100 in one request) — forcing 2+ sequential ~2s Oracle requests for
     a typical search. Fixed: raised to 100 in
     `fetch_oracle_listings.py`, cutting typical searches to one Oracle
     request. (A tempting-looking further optimization — dropping the
     `expand=requisitionList` param since nothing downstream reads the
     nested `workLocation` data it also pulls in — was tried and
     reverted: without `expand=requisitionList` at all the API returns
     zero actual postings, and `expand=requisitionList` alone costs the
     same ~1.9-2s as the fuller expand. Oracle's own list endpoint is
     just inherently ~2s server-side; this is a real external floor, not
     a client-side inefficiency.)
  3. **No hard ceiling on any single source.** Every source's own
     retry/timeout budget (15s per Python-subprocess source, up to 30s
     for a `fetch()`-based source with its one-retry-on-failure logic)
     could, in the worst case, block the *entire* search — Promise.all
     waits for every promise, so one hung/slow board held up results
     from all the fast ones too. Fixed with a real hard ceiling: `jobs.ts`
     gained `withDeadline()`, racing every one of the 7 source fetches
     against a **2200ms** deadline — a source that doesn't answer in time
     degrades to a "timed out" warning (shown in the UI's per-source
     badge) instead of blocking the rest of the search. Tuned from live
     measurement: hitting the deadline adds ~150-450ms of process/IPC
     overhead on top, so 2200ms keeps the worst-case total search
     reliably under the operator's 3-second target (measured 2.0-2.6s
     across 8 consecutive runs after the fix, including ones where a
     source did time out) while still comfortably covering Oracle's
     normal ~1.9-2.3s response most of the time. Also tightened the
     per-attempt timeouts feeding into that ceiling (raw-fetch sources:
     15s → 6s; Python-subprocess sources' `--timeout`: 15 → 8) so a
     genuinely hung request fails faster even before the outer race
     kicks in.
     **Load-bearing detail:** racing a promise doesn't cancel the
     underlying `fetch()`/spawned Python process — it just stops
     *waiting* on it. `packages/core/src/bridge.ts`'s `main()` previously
     relied on the Node process exiting naturally once every promise
     settled, which would have kept the process (and the Rust caller's
     blocking `Command::output()` wait on it) alive for as long as the
     abandoned straggler took, silently defeating the whole deadline.
     Fixed by calling `process.exit()` immediately after the stdout
     write's callback confirms it flushed, for every bridge command, not
     just search.
  **Verified:** all of the above with live timing measurements (not just
  typecheck) — 8 consecutive real searches against the operator's live
  config, config/board mix unchanged, before/after; clean
  typecheck/build across TUI, `@aplyx/core`, desktop (TS+Vite+Rust), and
  the extension; `checkJobFit`/`saveJobForReview` re-verified unaffected
  (they're single-target, not raced — only the multi-source `searchJobs`
  needed this).

- **Last completed phase (2026-07-21, operator-directed):** Phase 16B —
  ATS/source expansion — **IN PROGRESS, four sources added
  (SmartRecruiters, then Amazon + Oracle after the operator expanded the
  phase's scope to a company-specific-boards track)**, plus a search
  sort/filter feature requested alongside it. Full detail in
  docs/PLAN.md §3.18A; summary below.

  **Company-specific careers boards (2026-07-21, later in the same
  session).** The operator edited docs/PLAN.md directly to add a new
  track to §3.18A: alongside the ATS-vendor matrix, track high-priority
  employers with custom career pages that don't map to a shared ATS —
  named examples **Amazon, Google, Oracle**. Researched all three,
  shipped the two that had a genuine public JSON API:
  - **Amazon** — `amazon.jobs/en/search.json?base_query=...&result_limit=...&offset=...`
    is public, unauthenticated, and (unlike every other source in this
    phase) returns **full JD text directly in the list response** —
    confirmed live. Amazon is a single company, not a multi-tenant
    product, so it needed no per-company slug config: it's a plain
    board-name toggle (`"amazon"` in `targets.json` "boards"), same as
    linkedin/indeed. Shipped: `scripts/jobs/fetch_amazon_listings.py`
    (search + paginate, no `--jd-url` mode needed since JD is already
    present); `job_state.py` ATS inference extended for `amazon.jobs`
    URLs; `job-scraper.md` step 3b; manual search
    (`jobs.ts`/`jobsSort.ts`) gained `fetchAmazon` as a 6th toggle in
    both TUI and desktop. Verified live end to end: real postings with
    full JD (German/Irish/Chinese SDE internships), correct
    canonicalize (`ats_system: "amazon"`), correct fit-gate verdicts
    (a Bengaluru posting scored on real content).
  - **Oracle** — found via Playwright network inspection of
    careers.oracle.com (its search box has no visible public API from a
    plain curl; the real request only appears with a browser
    User-Agent hitting the underlying XHR, not the static HTML). The
    real endpoint,
    `<tenant>.fa.<region>.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions`,
    is Oracle's own **Fusion HCM REST API for Oracle Recruiting Cloud
    (ORC)** — a distinct, more modern product from the legacy Taleo ATS
    already in `job_state.py`'s URL patterns, and (importantly) used by
    many employers beyond Oracle itself, not just a one-off company
    adapter. Like Workday, it needed a tenant-config model
    (`"oracle_tenants": ["<host>/<siteNumber>"]`, e.g.
    `"eeho.fa.us2.oraclecloud.com/CX_45001"` for Oracle's own careers
    site) and lazy JD enrichment (list view's
    `ExternalQualificationsStr`/`ExternalResponsibilitiesStr` are null;
    only the per-requisition detail endpoint has them, confirmed live).
    The public job URL uses ORC's generic `hcmUI` path (works for any
    tenant, confirmed via a live 200, not just Oracle's own branded
    careers.oracle.com domain). Shipped:
    `scripts/jobs/fetch_oracle_listings.py` (list + `--jd-url` modes,
    same shape as `fetch_workday_listings.py`); `oracle_tenants` wired
    into both validators (missing/placeholder warn-and-skip, same as
    `workday_tenants`) with Oracle's own tenant seeded into the live
    config since it's already verified; `job_state.py` ATS inference
    extended for `oraclecloud.com` URLs; `job-scraper.md` step 3c;
    manual search gained `fetchOracle` as a 7th toggle in both
    surfaces. Verified live end to end: real requisitions, correct
    canonicalize (`ats_system: "oracle"`), a synthetic-JD fit-gate
    pass, and a real "Lead Principal Software Engineer" posting
    correctly `skipped_unfit` for requiring 10+ years.
  - **Google — researched, explicitly NOT implemented.** No public REST
    API found despite real effort (a plain curl to careers.google.com
    returns an empty SPA shell; only loading it in a real browser via
    Playwright and inspecting network requests revealed any data path
    at all). What's actually there is Google's internal "boq" closure
    hydration payload (`AF_initDataCallback` embedding a `ds:1` blob
    directly in server-rendered HTML, but only when the request carries
    a real browser User-Agent) — a deeply nested, **positional** (not
    keyed) array format with no field names, undocumented, and free to
    change shape at any time without notice. Parsing it reliably would
    need either a hand-written recursive-descent parser for this
    specific undocumented format (fragile, breaks silently on a schema
    change) or a real Playwright browser per fetch (expensive, and a
    different risk/cost class than every other source in this phase).
    Given AGENTS.md's own standing bias toward deterministic scripts
    over browser scraping and away from fragile-by-construction
    integrations, this was left unimplemented rather than shipped
    against an undocumented format — flag this for the operator if
    Google coverage becomes a priority; it would need either accepting
    the parsing fragility or a Playwright-per-search-query design (like
    LinkedIn/Indeed/Wellfound/Handshake already use).

  **Search sort/filter (requested alongside this phase).** Confirmed the
  manual search's default ordering was already correct end to end —
  `sortByPreferredThenPosted` in `packages/core/src/jobsSort.ts` (split
  out of `jobs.ts`, same fs-free-split reasoning as `stateDerive.ts`, so
  the desktop webview can call the real sort/filter functions, not just
  import their types) sorts preferred-location matches first but never
  drops a non-preferred posting, and the automated agent's own Phase 1
  step 12 ("process preferred_locations matches first; continue into
  fallback_scope matches after — do not stop early") already encoded the
  same rule. Added on top: `desktop/src/routes/shell/JobsScreen.tsx` gained
  a **Sort by** dropdown (Preferred location [default] / Recently posted /
  Company A–Z / Title A–Z) and a **Preferred locations only** filter
  toggle, both applied client-side against the already-fetched results
  (no re-fetch) via the new `sortByCompanyAsc`/`sortByTitleAsc`/
  `isPreferredLocation` exports. Verified with synthetic data: the
  preferred-first sort keeps every job (count unchanged), preferred
  matches float to the top, and the "preferred only" filter correctly
  narrows to just those.

  **Phase 16B — SmartRecruiters (first of the §3.18A source list).**
  Chosen first because its public Postings API
  (`api.smartrecruiters.com/v1/companies/{slug}/postings`) was verified
  live and behaves like Greenhouse's: real companies (Equinox — 676
  postings, Dominos — 24,454, Docusign, Wayfair, Visa) return real JSON,
  no auth. One difference from Greenhouse: the list endpoint carries NO
  JD text (confirmed live) — only the per-posting detail endpoint does —
  so it follows the Workday/SimplifyJobs JD-enrichment pattern instead
  (fetch JD lazily, after role filtering, before the fit gate). Shipped
  end to end: `scripts/jobs/fetch_smartrecruiters_listings.py` (list +
  `--jd-url` modes, same shape as `fetch_workday_listings.py`);
  `config/smartrecruiters_vetted_slugs.json` (5 hand-verified companies)
  wired into `seed_vetted_slugs.py`'s `SOURCES` map (which — found along
  the way — already covered Greenhouse but neither Greenhouse nor the new
  SmartRecruiters key was in `validate_local_config.{sh,py}`'s shape/
  placeholder checks; added both while extending the same pattern);
  `job_state.py`'s `ATS_URL_PATTERNS`/`ATS_SOURCE_MAP`/external-ID regexes
  extended for `smartrecruiters.com` URLs; `job-scraper.md` step 3a added
  (mirroring the Workday step's shape) plus the harness-capability-check
  board list and the `applied_jobs.json` source enum, both regenerated via
  `generate_agent_definitions.py`; manual search (`jobs.ts`/`jobsSort.ts`)
  gained a `fetchSmartRecruiters` (paginated, capped at 500/company so
  Dominos-sized boards can't starve the other sources) and a
  `checkJobFit` branch for the lazy JD fetch; both the TUI's
  `SearchScreen.tsx` and the desktop's `JobsScreen.tsx` gained
  SmartRecruiters as a 5th source toggle. **Verified end to end against
  the live public API** (not just typecheck): `fetch_smartrecruiters_listings.py`
  list + `--jd-url` modes both tested live; `job_state.py canonicalize`
  correctly resolves `ats_system: "smartrecruiters"` and the right
  `job_id`; `evaluate_job_fit.py` ran on a real fetched JD; the bridge's
  `searchJobs`/`checkJobFit` commands returned real current postings
  (a real "Sr. Data Engineer" at Equinox, correctly fit-gated to
  `skipped_unfit` for requiring 6+ years); both validators and the
  agent-definition drift check pass clean.

  **The other six §3.18A sources were researched, not implemented, this
  pass — explicitly deferred with reasons, not silently skipped:**
  - **Workable** — the public widget endpoint
    (`apply.workable.com/api/v1/widget/accounts/{slug}`) responds and
    parses, but returned an **empty jobs array for every real, definitely-
    hiring company tested** (Revolut, Monzo, Deliveroo, Typeform, GitHub,
    GitLab, Automattic) — the endpoint may be deprecated/restricted for
    job data specifically. Do not implement against this endpoint without
    first finding a company where it actually returns populated jobs, or
    finding Workable's current documented API.
  - **BambooHR** — careers pages live at `{tenant}.bamboohr.com/careers/
    list`, but a guessed tenant ("gusto") 302-redirected to BambooHR's own
    marketing site, meaning tenant discovery needs the same hand-verified-
    subdomain approach Ashby/Lever/Greenhouse/SmartRecruiters used — not
    yet done.
  - **Jobvite** — a guessed tenant URL returned a 302; the real public
    data shape (JSON API vs. server-rendered HTML) is still unresearched.
  - **Rippling ATS** — a guessed tenant URL 404'd; needs a real known
    Rippling-ATS customer to test against.
  - **iCIMS, Taleo/Oracle** — per §3.18A's own framing, these are
    enterprise/tenant-specific systems with no consistent public API by
    design (heavily customized per tenant) — the higher-effort tier,
    correctly left for last.
  Per AGENTS.md/PLAN.md's own standing principle ("maximize reliable,
  early, maintainable sources," not raw count) and the operator's
  standing preference for verified-over-fast work, none of these six were
  implemented against unverified assumptions this pass.

- **Previously last completed phase:** Phase 14B — the desktop app's real Jobs/
  Review/History/Resumes screens, at parity with the TUI — 2026-07-21,
  operator-directed (sequenced ahead of phase 12, which stays deferred,
  and ahead of phase 16B and the rebrand, per this session's explicit
  ordering). Preceded by a project-wide **placeholder rename,
  `aplyx` → `aplyx`**, done first in the same session so 14B and the
  upcoming phase 16B/rebrand work wouldn't be built under the
  known-temporary old name — every identifier surface (npm package
  names, CLI bin, Tauri bundle id + deep-link scheme, launchd label,
  `APLYX_*` env prefix, the desktop logo wordmark, the TUI's ANSI-Shadow
  banner art) was updated; the real GitHub repo path (`keshm2/aplyx`)
  was deliberately left alone since the actual repo rename rides with
  the real rebrand later, not this placeholder pass.

  **Phase 14B itself:** added real `JobsScreen`/`ReviewScreen`/
  `HistoryScreen`/`ResumesScreen` to `desktop/src/routes/shell/`,
  replacing the "coming in the next update" placeholders — through the
  exact same `LocalAdapter`-backed bridge seam the Home/Settings
  screens already used, no new write path. Shared-core groundwork that
  made this possible: `state.ts` split into a new fs-free
  `stateDerive.ts` (types + `isResolved`/`hasAppliedOrFailed`/
  `isDismissed`/`registryByJobId`/`todayIso`) so the desktop webview can
  use those pure derivations directly against a `AplyxState` it already
  loaded, without pulling in `state.ts`'s `node:fs` reads into the
  browser bundle (the exact hazard that made `hostedFields.ts` split
  from `profile.ts` back in phase 11/14A — caught here the same way, by
  a Vite externalization error, and fixed the same way); the TUI's
  `app/src/jobs.ts` (board fetchers + canonicalize/fit/save) and
  `app/src/resumes.ts` (resume-folder listing) moved to
  `packages/core/src/` verbatim with re-export shims left in `app/src/`
  for backward compatibility, since both are already framework-agnostic
  Node code the new bridge commands could reuse directly; a new
  `packages/core/src/reviewActions.ts` extracted the TUI
  `ReviewScreen`'s inline mark-applied/dismiss logic into shared
  functions the desktop bridge calls too, and the TUI screen was
  refactored to call them instead of duplicating the logic (net
  reduction, not just a move). New bridge commands (Rust
  `#[tauri::command]` → `packages/core/src/bridge.ts` dispatcher):
  `searchJobs`, `checkJobFit`, `saveJobForReview`,
  `markQueueEntryApplied`, `dismissQueueEntry`, `listResumeDetails`,
  `openResumesFolder` — every one shells out to the identical helpers
  the TUI and the automated agent already use; no new state-write path,
  no forked business logic.

  **Verified:** clean typecheck/build across the TUI, `@aplyx/core`,
  the desktop TypeScript + Vite bundle (no `node:fs`/`child_process`
  externalization warnings — the regression check for the stateDerive
  split), the Rust side (`cargo check`), and the browser extension; the
  TUI smoke test still passes end to end. Every new bridge command was
  exercised for real against an isolated scratch copy of `data/`+
  `config/` (never the operator's live files) with Google Sheets sync
  disabled in that scratch config: `searchJobs` hit live Ashby/Lever/
  Greenhouse and returned real current postings; `checkJobFit` ran the
  real deterministic fit gate; `saveJobForReview` saved once and
  correctly deduped on retry; `markQueueEntryApplied` correctly refused
  a real malformed legacy queue entry missing required fields (proving
  the no-fabrication guard survives real-world data irregularities) and
  correctly recorded a well-formed synthetic one end to end (applied_jobs
  entry + registry status transition + event log, byte-verified);
  `dismissQueueEntry` recorded `skipped_unfit` and correctly refused a
  second dismiss of the same entry; `listResumeDetails` matched the
  real `data/resumes/` contents. **Not verified**: the actual rendered
  React UI in a live Tauri window (this session had no way to drive a
  native GUI window) — the business-logic layer every screen calls is
  fully verified above, but a real click-through pass on
  `/Applications/aplyx.app` (or `npm run tauri dev`) is still worth
  doing before calling 14B fully done.

  **Two real bugs found immediately by the operator actually running the
  installed app (2026-07-21, same day) — exactly the gap the "not
  verified" note above flagged, both fixed:**
  1. **"core bridge not found at /Users/runner/work/aplyx/aplyx/..."** —
     `desktop/src-tauri/src/lib.rs`'s `bridge_script_path()` resolved the
     bridge script via `env!("CARGO_MANIFEST_DIR")`, a path baked in at
     *compile* time. `.github/workflows/desktop-release.yml` compiles
     prebuilt release bundles on a GitHub Actions runner, so that path
     only ever existed on the CI machine — every downloaded/installed
     build was broken this way, not just this one. Fixed by declaring
     `packages/core/dist` as a real Tauri bundle resource
     (`tauri.conf.json` → `bundle.resources: {"../../packages/core/dist":
     "core"}`) and resolving it at *runtime* via
     `app.path().resolve("core/bridge.js", BaseDirectory::Resource)`,
     falling back to the old dev-relative path only for a `tauri dev`
     checkout. Verified: a real build's `Contents/Resources/core/
     bridge.js` exists; the compiled binary, run with
     `packages/core/dist` temporarily renamed away (so the dev fallback
     *cannot* work), stays alive rather than crashing.
  2. **"Couldn't find a local aplyx installation... Run from inside the
     repo or set APLYX_ROOT"** — `findProjectRoot()`
     (`packages/core/src/project.ts`) only ever succeeds via a shell env
     var, the process's working directory, or upward from the compiled
     bridge's own location — none of which exist for a Finder/Dock-
     launched app (no env vars, no meaningful cwd, and the bridge now
     lives inside the app bundle thanks to fix #1, nowhere near the
     user's actual checkout). `desktop/src/routes/onboarding/local/
     LocalWizard.tsx`'s root-error state was a dead end: a message and a
     "← Back" button, no recovery. Fixed with a real recovery path: new
     `isValidProjectRoot()` export + `validateRoot` bridge command/Rust
     command; `desktop/src/lib/bridge.ts` gained `setLocalRoot()`/
     `forgetLocalRoot()` backed by a `localStorage` key
     (`aplyx.localRoot`) that `findRoot()` now checks before
     auto-detecting; `LocalWizard`'s error state and `SettingsScreen`'s
     "Local install" section both gained a "Browse for my aplyx
     folder…" button (`@tauri-apps/plugin-dialog`'s directory picker,
     already a granted capability) so a real folder pick sticks across
     launches instead of needing auto-detection to work at all. Verified:
     `validateRoot` accepts the real checkout, rejects `/tmp` with a
     clear message, and normalizes a non-canonical path to the resolved
     root; clean typecheck/build across TUI/core/desktop(TS+Vite)/Rust
     afterward. A rebuilt bundle was reinstalled to `/Applications/
     aplyx.app` and relaunched for the operator to click through — the
     one thing this session still can't verify itself is the actual
     click path in the live window.
  3. **The manual browse step above is a real fix for a returning user
     on this dev machine, but the operator correctly flagged it as
     unacceptable friction for a brand-new install** — anyone who ran
     `install.sh` should never see the root-detection screen at all.
     Root-caused: nothing the installer already knows (the checkout
     path it just cloned to / is running from) was ever communicated to
     the desktop app, which has no cwd/env-var signal of its own once
     installed. Fixed with a small durable pin file,
     **`~/.aplyx/root`** (one absolute path, nothing else) —
     `packages/core/src/project.ts` gained `pinnedRootFile()`/
     `readPinnedRoot()`/`writePinnedRoot()`, and `findProjectRoot()` now
     checks it (after `$APLYX_ROOT`/`$ARES_ROOT`, before the cwd/
     `import.meta.url` fallbacks that mean nothing for a GUI app). All
     four installers — `install.sh`, `install_desktop.sh`, and their
     `.ps1` equivalents — now write this file unconditionally, first,
     right after resolving their own checkout path (both desktop-install
     scripts write it too, not just `install.sh`, since they're each
     documented as independently re-runnable standalone). The manual
     "browse for my aplyx folder" picker from fix #2 also now writes this
     same pin file on a successful pick (`validateRoot`'s bridge-side
     handler), so a one-time manual fix self-heals future launches and
     reinstalls too, not just this browser's `localStorage`. **Verified
     end to end, simulating a genuinely brand-new install**: cleared the
     app's WebKit storage (`~/Library/WebKit/com.aplyx.desktop`,
     `~/Library/Caches/com.aplyx.desktop`) and deleted `~/.aplyx/root` —
     confirmed `findRoot` has nothing to resolve from at that point (the
     original bug, reproduced on demand); wrote `~/.aplyx/root` by hand
     (exactly what the installers now do) and relaunched with the
     WebKit/localStorage cache still clean — `node bridge.js findRoot`
     with no `APLYX_ROOT` env and an unrelated cwd now resolves correctly
     via the pin alone. `bash -n` clean on both edited `.sh` files; the
     two `.ps1` edits were reviewed by hand (no PowerShell interpreter on
     this machine to run them against).

  **What's still not done** (unchanged from 14A's note, still Phase
  14B-adjacent scope not attempted this pass): hosted↔local
  pipeline-state sync (`SupabaseAdapter.loadState()` still returns
  `undefined` — the new screens only render against `LocalAdapter`
  data); a one-shot full-state local→hosted migration beyond the
  existing per-field profile import.

  Before this: Phase 14A polish on top of the hosted
  backend + desktop app shell below — 2026-07-17, operator-directed.
  Released as **0.9.7a**: all three installers (`install.sh`/`.ps1`)
  now offer the desktop app as an opt-in step alongside the TUI, via
  new standalone `scripts/install/install_desktop.{sh,ps1}` (detects
  Rust + OS-native build deps, asks before installing anything
  missing, builds in release mode, installs the platform-native way —
  `/Applications` on macOS, apt/dnf/AppImage on Linux, a no-elevation
  NSIS installer on Windows); `uninstall.py` removes it too, if
  present. Fixed a real latent bug found along the way: `packages/core`
  had no build hook, so both the TUI's and desktop's installer build
  steps silently depended on a prior build already having happened —
  never true on a fresh clone. Desktop app: fixed the hosted+local
  wizards replaying on every sign-in/launch instead of once (new
  `profiles.onboarding_completed` column + `SupabaseAdapter` methods,
  `AuthContext` resolves it on every session change; a persisted
  Supabase session now resumes straight into the app on relaunch
  instead of re-showing the entry chooser); real brand logo (block
  lowercase "a", traced from the operator's image) replacing the
  placeholder mark, TUI-matched violet/pink palette with a beige light
  theme, Settings gained theme (system/light/dark) and font
  (system/Geist, bundled) pickers, tag-style search-and-chips for
  company/location preferences (shared `packages/core/src/
  autocomplete.ts`, moved from the TUI so both surfaces use one fuzzy
  matcher), and coding-agent detection now probes common install paths
  beyond `$PATH` (Homebrew/nvm/volta/etc.) since a Finder-launched .app
  inherits launchd's minimal PATH. `BUILD_MARKER` moved to
  `packages/core/src/version.ts` so the TUI's side-panel footer and
  the desktop app's Settings screen (new, faded "build 0.9.7a" line)
  read the same one constant. Before this: Phase 11 (hosted Supabase
  backend) + Phase 14A (Tauri desktop app shell) — 2026-07-16, built
  together and out of the originally suggested order (ahead of phase
  12) because the operator wanted "Sign in" real from day one instead
  of stubbed. See the "Phase 11 + 14A" entry below and docs/PLAN.md
  §3.12/§3.15 for what shipped, including two deliberate deviations
  from those phases' original text: password auth (not magic-link
  first) and profile PII synced to the hosted `profiles` table (not
  kept local-only). Before that, Phase 16 — multi coding-agent support
  (2026-07-13: codex/copilot adapters in run_job_agent.sh, 4-agent
  installer detection, capability matrix + degraded paths below,
  scripts/run_conformance.py with results in docs/SETUP.md §2.8;
  codex/copilot live conformance runs pending on a machine with
  those CLIs). Phases 0–10, 11, and 16 are DONE (phase 10's live
  autofill pass pending); phases 13, 14A, and 15 are partially done.
- **Completed work items:** Phase 11 + 14A — hosted backend + desktop
  app shell (2026-07-16, operator-directed. **Shared core extracted:**
  `app/src/{state,helpers,settings,platform,project,harness,
  profileLinks,companyTargets,data/*}.ts` and the onboarding field
  schema (`ui/onboarding/pages.ts` → `packages/core/src/onboarding/
  fields.ts`) moved into a new npm-workspace package `@aplyx/core`
  (root `package.json` gained `workspaces`); `app/` imports them
  unchanged via `@aplyx/core/*` — verified byte-behavior-identical by
  `npm run smoke --workspace=app` passing unchanged. New `Adapter`
  interface (`packages/core/src/adapter.ts`) with `LocalAdapter`
  (wraps the existing Python-helper calls) and `SupabaseAdapter` (pure
  `@supabase/supabase-js`, no Node APIs — runs directly in a Tauri
  webview) implementations; `onboarding/hostedFields.ts` split out
  from `onboarding/profile.ts` so importing `SupabaseAdapter` never
  transitively pulls in `node:fs` (verified via a clean Vite build with
  no externalization warnings). **Supabase schema:**
  `supabase/migrations/0001_init.sql` — `profiles`/`jobs`/`job_events`/
  `applied_jobs`/`review_queue` tables + a private `resumes` storage
  bucket, every table/bucket RLS-scoped to `auth.uid()`, plus a
  status-transition-guard trigger on `jobs` mirroring
  `job_state.py record-event`'s never-downgrade rule.
  `config/supabase.example.json` + gitignored `config/supabase.json`
  follow the existing config convention; `validate_local_config.{sh,py}`
  both gained a non-fatal warn-and-continue check for it (mirrors the
  Google Sheets check). **Desktop app** (`desktop/`, Tauri v2 + React
  19 + Vite, scaffolded via `create-tauri-app`): local mode's frontend
  never touches `node:fs`/`child_process` directly — it calls narrow
  `#[tauri::command]`s in `desktop/src-tauri/src/lib.rs`, which spawn
  `packages/core/dist/bridge.js <cmd> <jsonArgs>` over stdio (a
  subprocess, not a localhost server) and reuse the exact
  `LocalAdapter`/helper functions the TUI already uses; hosted mode's
  frontend calls Supabase directly. Screens: a landing-style entry
  screen (Run locally / Sign in, both real), a local onboarding wizard
  (Welcome → Environment checks → coding-agent detect/select → the 8
  shared profile field-pages → resume import+convert → Discord
  notifications → browser-extension folder → review/finish, writing
  through `LocalAdapter`), a hosted onboarding wizard (sign-in
  confirmation → import-from-local-or-start-fresh → the same 8 shared
  field-pages via `SupabaseAdapter` → resume upload to Supabase
  Storage → finish), and an app shell (Home + Settings real; Jobs/
  Review queue/History/Resumes render an explicit "coming in the next
  update" placeholder — Phase 14B). Hand-authored SVG logo (a
  three-arc "signal" mark, `desktop/src/assets/logo-mark.svg`) rasterized
  and run through `tauri icon` for the full icon set; design tokens in
  `desktop/src/styles/tokens.css` (warm neutral canvas, one violet-plum
  accent, system-font stack — no bundled/CDN fonts — light+dark via
  `prefers-color-scheme` and an explicit `data-theme` override).
  **Not done here (Phase 14B, separate follow-up):** the real Jobs/
  Review/History/Resumes screens; hosted↔local pipeline-state sync
  (`SupabaseAdapter.loadState()` intentionally returns `undefined` until
  then). **Operator actions still needed:** create a real Supabase
  project + Google Cloud OAuth client and populate `config/
  supabase.json` (config/supabase.example.json documents the shape;
  docs/PLAN.md §3.12 has the click-through steps) — until then hosted
  sign-in shows a graceful "not configured" state rather than erroring;
  a Rust toolchain (`rustup`) is required to build `desktop/` and was
  installed via Homebrew on the dev machine during this work.);
  interest letters + 0.9.1a (2026-07-16 —
  work item #4: a run that meets a "why do you want to work here?"
  question now PARKS the job (scripts/state/interest_letter.py) instead
  of inventing an answer, records nothing, and moves on; the user writes
  or generates+edits+approves an answer in the TUI's Letters tab, and
  approval is what lets the next run apply. Parking is not needs_review
  on purpose — can-apply blocks that status, which would make the answer
  unusable. New @interest-letter agent (draft-only, never approves,
  may honestly decline). Harness argv extracted to
  scripts/runtime/harness_adapter.py — the ONLY place allowed to branch
  per harness — proven argv-identical before the swap, so all four
  coding agents stay in sync by construction. MIN_COLUMNS 54->76 for the
  7-tab row. Released 0.9.1a);
  setup/search/apply hardening
  (2026-07-16 — **PII: a real home address shipped as a committed
  placeholder in app/src/ui/onboarding/pages.ts, reached origin/main
  and npm 0.9.0-alpha.0/1/2; purged from source, but the published
  tarballs and git history still carry it — operator remediation
  pending.** Also: targets.example.json safe_fields no longer prefill
  template junk on a fresh install (all REPLACE_ME); preferred_locations
  no longer preloaded; wizard commits drafts on blur (the "target jobs
  not saved" bug — drafts were discarded unless Enter was pressed);
  shift+→ commits before gating; autocomplete no longer silently
  substitutes a fuzzy match for a typed city; up/down move between
  fields; new email/graduation_date/gender fields; DOB auto-slashes and
  refuses invalid digits; Settings gained "Open resumes folder" and a
  detected-agent label; search matches inflections so "software
  engineering intern" finds "Software Engineer Intern"; preferred
  locations sort to the first page; ~150 metro suburbs added to
  US_CITIES; job-scraper.md gained the exact-match dropdown protocol +
  mandatory pre-submit form verification);
  run observability + stop-any-run
  (2026-07-16 — fixed three stacked defects behind "phases don't show
  up / no way to stop": CHECKLIST_SLOTS matched infinitives
  (`/scrape/`, `/fit.?gate/`) against participle markers ("Scraping",
  "fit-gating") so 2 of 5 slots never matched and the scrape phase
  showed no checklist at all; progress was re-derived per render from
  the 200-line display tail, so completed phases reverted to pending
  and the caption could report "Scraping" during an apply; and the
  opening `[•] Scraping job boards` marker was never emitted — now
  seeded deterministically by run_job_agent.py, with the body demanding
  it as the first output line. Also: `x` now stops runs the TUI didn't
  spawn (scheduler ticks, runs orphaned by `q`) via the runner's lock
  pid file; hint bar shows live-run keys instead of the dead e/p/s set.
  Verified by replaying a real 794-line session log);
  TUI manual/automatic modes (2026-07-12);
  project rename Ares → aplyx + TUI accessibility pass (2026-07-12 —
  `aplyx` is the command/package name, env vars are `APLYX_*` with
  legacy `ARES_*` fallbacks); TUI responsive layout + welcome page
  (2026-07-12 — banner/lists resize with the terminal, Jobs tab
  opens browsing instead of typing); TUI run controls polish
  (2026-07-12 — cap tier colors + MAX warning, optional
  APLYX_EXTRA_PROMPT per-run instruction); opencode `--print` CLI
  fix + TUI resize invariant + large-terminal fill (2026-07-12);
  fetch-efficiency rules (2026-07-12 — see "Fetch efficiency" under
  Critical rules); installer coding-agent choice (2026-07-12 —
  Codex/Copilot planned in phase 16); easier setup + TUI polish
  (2026-07-12 — installer curl|bash bootstrap and profile prompts
  with a local-only privacy notice, root `resumes/` PDF drop-folder
  (gitignored), README bash/cURL/npm install options, welcome-menu
  row tiers + MIN_COLUMNS 44 resize fixes, esc-to-menu navigation,
  sidebar first-name greeting + status rows, 12-hour local clock
  with time zone); TUI density redesign + input fixes (2026-07-12 —
  two-pane rules+columns layouts via ui/Pane.tsx on Jobs/Review/
  History/Status, AUTO cockpit with cap gauge + heartbeat counters +
  full-height log tail, randomized per-launch sidebar greeting,
  backspace fix: DEL 0x7f now erases backward in all text editors);
  release 0.7.8a (2026-07-12 — npm package is **@keshm/aplyx**
  0.7.8-alpha.0, the unscoped `aplyx` npm name is owned by an
  unrelated package; README banner + agent artwork in docs/assets/;
  npm publish pending `npm login`); one-command install +
  auto-update (2026-07-13 — root `VERSION` + `scripts/update.sh`,
  auto-hooked into runs and TUI launches with APLYX_AUTO_UPDATE=0
  opt-out, installer writes the `aplyx` wrapper to ~/.local/bin;
  releases must bump root `VERSION` to trigger client updates);
  release 0.7.9a (2026-07-13 — dedicated uninstaller
  scripts/uninstall.sh + `aplyx uninstall`; README trimmed to
  install/updates/uninstall/usage/safety, phase content moved to
  docs; first auto-update rollout; Discord made optional — install
  opt-in with one-channel vs separate-channels choice, disabled
  config = local-only outcomes, validator/reporter skip cleanly);
  TUI Settings tab (2026-07-13 — Config tab 5: personal info incl.
  preferred_name greeting, Discord toggle/routes, persisted APLYX_*
  overrides in gitignored config/env.json exported by the runner
  with an APLYX_/ARES_ prefix filter; APLYX_LOG_DIR honored by
  runner/heartbeat/TUI).
- **Implement next:** **phase 16B is IN PROGRESS** (SmartRecruiters
  shipped; Workable/BambooHR/Jobvite/Rippling/iCIMS/Taleo researched and
  explicitly deferred — see the phase-16B entry above for why each) —
  continuing it (the next source, most likely BambooHR or Jobvite once
  a real tenant is found to verify against) is the natural next step,
  still under the operator-directed sequencing from 2026-07-21 that
  supersedes the phase-12-next default below: 16B, then the real rebrand
  (permanent name/license/category, replacing the `aplyx` placeholder —
  docs/product-positioning-and-rebrand-plan.md), with **phase 12 (cost
  tiering) explicitly deferred** past both. Each still needs its own
  explicit go-ahead before starting, per the one-phase-at-a-time rule.
  Phase 13 remains partial (npm publish pending `npm login`;
  provider-setup and hosted storage deferred); phase 15's full-run
  parity check remains an operator action (the 2026-07-13 conformance
  legs are the first live
  signal).
- Whoever closes a phase or work item MUST update this block and the
  matching pointer at the top of docs/PLAN.md before stopping.

## Single-user deployment (phase 9)

**aplyx runs as one user on one machine.** State files in `data/`,
live configs in `config/`, logs in `logs/`, and the resume folder
(`data/resumes/`) are all implicitly per-user — there is
no profile abstraction and none should be introduced without an
explicitly approved phase. Two people who want to run aplyx on the
same machine today do so via **two separate clones** with two
separate configs (see docs/SETUP.md "Two users on one machine");
profile-based multi-user is a deliberately deferred future migration.

### Per-user vs. project-owned files

| Class | Files | Notes |
| --- | --- | --- |
| Per-user: live config | `config/targets.json`, `config/discord_config.json`, `config/google_sheets_config.json`, `config/service-account-key.json`, `config/harness.json`, `config/extension_bridge.json`, `.claude/settings.json` | All gitignored; hold PII/secrets/per-machine choices |
| Per-user: runtime state | `data/applied_jobs.json`, `data/review_queue.json`, `data/job_registry.json`, `data/job_events.jsonl` | Written only by the `scripts/` helpers |
| Per-user: personal documents | `data/resumes/` (markdown resumes + cover letter, each with a matching PDF) | Gitignored PII |
| Per-user: logs + heartbeat | `logs/` (`run_job_agent.log`, `session_*.log`, `heartbeat.json`, `launchd.{out,err}.log`, `tmp/`) | Retention pruned by the runner |
| Per-user: browser artifacts | `.playwright-mcp/` | Playwright profile/session state |
| Per-user: schedule | `~/Library/LaunchAgents/com.aplyx.job-agent.plist` | Lives outside the repo; label is fixed (see seams) |
| Project-owned | `scripts/`, `agents/` (+ generated `.claude/agents/`, `.opencode/agents/`), `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/SETUP.md`, `docs/RELEASE.md`, `docs/CHANGELOG.md`, `config/*.example.json`, `config/{ashby,lever}_vetted_slugs.json`, `requirements.txt`, `opencode.jsonc`, `.mcp.json`, `app/`, `extension/`, `.github/`, `.gitignore` | Committed; identical across users |
| Project-owned, local-only | `docs/PLAN.md` | Gitignored by design (plan/handoff doc), but not per-user data |

### Future multi-user seams (documented only — do NOT parameterize now)

A future profile-based migration would need exactly these paths to
become parameters; every one is read from a single, mechanical place
today:

- **Config paths** — `config/*.json`, read directly by
  `validate_local_config.sh`, the agent prompts, `install.sh`, and
  the TUI wizard/state readers.
- **Runtime data directory** — `data/`; `job_state.py` defaults are
  module constants overridable per-call via `--registry` / `--events`
  / `--applied` CLI flags, and `append_state_entry.sh` takes the
  target file as its first argument.
- **Log directory + heartbeat** — `logs/` in `run_job_agent.sh` and
  the `HEARTBEAT = "logs/heartbeat.json"` constant in
  `write_heartbeat.py`.
- **Playwright profile directory** — `.playwright-mcp/`.
- **Google service-account key path** — the
  `service_account_key_path` field inside
  `config/google_sheets_config.json`.
- **Resume folder** — `data/resumes/`.
- **launchd label** — `com.aplyx.job-agent` is fixed in
  `scheduler.sh`, so two clones cannot both install the 30-minute
  schedule today; a second install would need a per-clone label.
- **TUI root** — already parameterized: `$APLYX_ROOT` (legacy
  `$ARES_ROOT`) selects the project root, the ready-made pattern for
  the other seams.

## Critical rules (never break these)
- ALWAYS read data/applied_jobs.json before starting any application run.
  Never apply to a job whose URL or job_id already exists in that file.
- ALWAYS read config/targets.json for role_keywords, level_keywords, and
  locations before scraping.
- ALWAYS write a result entry to data/applied_jobs.json after each
  application attempt — success OR failure — before moving to the next
  job. This also covers user-visible needs_review outcomes that occur
  before a real application submission (e.g. ATS score below threshold
  during tailoring): append a needs_review entry so future runs do not
  re-tailor the same job forever. skipped_unfit is local-only and must
  never be written to applied_jobs.json.
- Max 25 applications per session (rate limit protection). The TUI's
  automatic mode may lower this per run via APLYX_SESSION_CAP (1–25;
  the legacy ARES_SESSION_CAP name is honored as a fallback);
  the cap can never exceed 25. scripts/runtime/run_job_agent.sh reads
  APLYX_SESSION_CAP (default 25), clamps values above 25 down to 25,
  and falls back to 25 on invalid or below-1 input, then injects the
  effective cap into the run prompt so the orchestrator is explicitly
  told the per-session limit. The runner may also append an optional
  operator instruction (APLYX_EXTRA_PROMPT, truncated to 500 chars,
  set from the TUI's automatic-mode prompt field) to the run prompt.
  That instruction can narrow or focus a run but NEVER overrides this
  file, the session cap, or the state-write discipline — if it
  conflicts with a rule here, the rule wins.
- NEVER accept an unconfirmed dropdown/combobox match, and ALWAYS verify a
  form before submitting it. Typing into an ATS location/school/degree
  widget only *highlights* an option — pressing Enter or tabbing away
  commits whatever happened to be highlighted (typing "Seattle" has
  selected "Settle", or simply the first entry starting with "Se"). For
  every `<select>` / combobox / typeahead: choose the option whose visible
  text matches the intended value EXACTLY (case-insensitive, trimmed),
  never by index, position, or "closest match"; then read the committed
  value back and confirm it. If no exact option exists, or several match
  equally, route the job to needs_review ("dropdown '<field>' has no exact
  option for '<value>'; user to apply manually") — never guess. Before
  every submit, snapshot the form and verify each filled value equals the
  safe_fields value it came from and that no field the user left blank has
  acquired a value; on any mismatch, do not submit — needs_review instead.
  A wrong answer on a submitted application is irreversible. See
  job-scraper.md Phase 3 steps 3 and 6 for the full protocol.
- NEVER write a free-text motivation answer ("Why do you want to work at
  X?", "Why this role?") yourself, and never leave it blank when required.
  Ask `scripts/state/interest_letter.py approved-text '<job_key>'`: exit 0
  means the user approved an answer — paste stdout verbatim and apply. Exit
  2 means park the job via `interest_letter.py request '<json>'`, print
  `[parked] <title> @ <company> — awaiting interest letter`, and move on.
  A parked job records NOTHING — no record-event, no applied_jobs.json row,
  no review_queue row, no Discord. Parking is not an outcome; the job is
  unfinished. This is the one deliberate exception to "record every job you
  touch", and it is load-bearing: a needs_review entry would make
  `can-apply` block the job permanently, so the user's answer could never
  be used. `interest_letter.py pending` is read once at the start of
  tailoring so parked jobs aren't re-tailored every run. An invented reason
  is a claim the applicant gets asked to defend in an interview — that
  asymmetry is why drafting is a user-reviewed TUI action
  (`generate_interest_letter.py` saves a DRAFT, never an approval), not
  something the apply loop does.
- Never store passwords, SSNs, or payment info anywhere. If a form requests
  these and they aren't in config/targets.json under "safe_fields", skip the
  job, log it to data/review_queue.json via the state helper (see File
  write discipline), and record a needs_review event via record-event.
- After every applied, needs_review, or failed outcome, call the
  @discord-reporter subagent to send a per-outcome notification (success,
  needs_review, or failed webhook respectively). After every batch, call
  @discord-reporter to send the summary (summary webhook, or success
  webhook as fallback). Never invoke @discord-reporter for skipped_unfit.
  Discord is OPTIONAL: when config/discord_config.json is missing or has
  "enabled": false, the reporter logs one skip line and outcomes stay
  local (state files + TUI). Never treat a disabled reporter as a failed
  outcome.
- ALWAYS canonicalize every raw job that survives the deterministic
  role/level prefilter into one internal record via the canonical helper
  (scripts/state/job_state.py) before any dedup or fit decision. A
  deterministic raw-title prefilter (the role/level keyword rule plus
  the fetch-efficiency shortlist bound below) MUST run before
  canonicalization to bound work — prefiltered-out jobs are never
  recorded, acted on, or mentioned to the user.
- Fetch efficiency (bounded transcript, bounded work — every run):
  - Redirect EVERY board fetch and fetch-helper output to a file under
    logs/tmp/ (mkdir -p logs/tmp first; the runner clears it each run).
    NEVER print raw posting dumps into the session transcript — after
    each fetch print only the board name and a line count.
  - Prefilter deterministically (python/grep over the raw files, using
    the role/level keyword rule) into logs/tmp/prefiltered.jsonl; only
    survivors are canonicalized and upserted.
  - Bound the shortlist: stop adding candidates once the prefiltered
    shortlist reaches 5x the session cap (minimum 10). Unprocessed raw
    jobs simply wait for the next scheduled run.
  - Print at most ~30 shortlist lines (company · title · url) into the
    transcript when reviewing candidates.
- ALWAYS upsert each canonical record into data/job_registry.json via the
  canonical helper — never hand-write the registry.
- ALWAYS run the deterministic JD fit gate on every canonical job after
  role filtering and before tailoring:
  `python3 scripts/jobs/evaluate_job_fit.py '<canonical-job-json>'`
  The helper returns fit_status of skipped_unfit, needs_review, or
  candidate (plus fit_score, reasoning, fit_reasons,
  matched_role_keyword, matched_level_keyword, matched_level_source,
  years_required, decision_version). Only candidate jobs proceed to
  @resume-tailor. skipped_unfit is local-only (record via record-event,
  never Discord/applied_jobs.json/sheet). needs_review from the fit gate
  is a user-visible manual-review outcome before application: append to
  data/applied_jobs.json and data/review_queue.json, record a
  needs_review event, and send the needs_review Discord notification. Do
  not tailor skipped_unfit or needs_review jobs.
- ALWAYS re-check can-apply via the canonical helper immediately before
  any application attempt, even if the job passed earlier filtering. If
  can-apply refuses, skip the job and record a skipped_unfit event.
- ALWAYS re-run the deterministic fit gate immediately before applying
  (pre-apply fit confirmation). If the fit gate no longer yields
  candidate, do not apply — handle skipped_unfit/needs_review the same
  way as the pre-tailoring gate.
- skipped_unfit events are local-only: record them via the canonical
  helper's record-event, but never route them to Discord or
  data/applied_jobs.json.
- ALWAYS record an internal event via record-event for every applied,
  needs_review, or failed outcome.
- ONLY successful applications (status "applied") are synced to the
  Google Sheet internship tracker via scripts/jobs/sync_internship_tracker.py
  — exactly one row per successful application, and only after the
  applied_jobs.json entry and internal event are recorded. needs_review,
  failed, and skipped_unfit outcomes must never be written to the sheet.
  The sheet is user-facing: pass only the current visible tracker fields,
  never internal-only fields. See "Internship tracker (Google Sheets)
  sync" below.

## Harness capability matrix (phase 16)

aplyx runs under four coding agents. Business logic is identical
everywhere — the only harness-specific code is the adapter block in
`scripts/runtime/run_job_agent.sh` (never add harness branches anywhere
else). Capabilities differ; the degraded paths below are behavioral
rules that keep the least-capable harness honest without weakening
the helpers or prompts.

| Capability | opencode | Claude Code | Codex CLI | Copilot CLI |
| --- | --- | --- | --- | --- |
| Subagent registry (`@resume-tailor`, `@discord-reporter`, `@interest-letter`) | yes (`.opencode/agents/`) | yes (`.claude/agents/`) | no → inline fallback | no → inline fallback |
| Interest-letter drafting (pure text, no browser) | yes | yes | yes (inline) | yes (inline) |
| Browser automation (Playwright MCP) | yes (`opencode.jsonc`) | yes (`.mcp.json`) | no by default → API-boards path | no by default → API-boards path |
| Shell / helper execution | yes | yes | yes (user's sandbox/approval config) | yes (`--allow-all-tools`) |
| File read/write | yes | yes | yes | yes |
| Project instructions | `AGENTS.md` (native) | `CLAUDE.md` → `AGENTS.md` | `AGENTS.md` (native) | prompt-passed; read `AGENTS.md` |

**All harness-specific argv lives in `scripts/runtime/harness_adapter.py`**
(`agent_command`) — the only module allowed to branch per harness. Both
`run_job_agent.py` and `generate_interest_letter.py` go through it, so a new
agent works on all four harnesses by construction rather than by remembering
four call sites. Do not add a harness branch anywhere else.

**Degraded paths (mandatory when the capability is missing):**

- **No subagent registry** — when the workflow delegates to
  `@resume-tailor`, `@discord-reporter` or `@interest-letter`, read
  `agents/bodies/<name>.md` and perform that role inline, following
  it exactly. Helper calls, routing rules, and state writes are
  unchanged. `harness_adapter.agent_command` builds this preamble
  automatically for codex/copilot.
- **No browser automation** — fetch and process **API-fed boards
  only** (Ashby, Lever, SimplifyJobs, Workday CXS). Any job whose
  application would require a browser is routed to `needs_review`
  with reasoning "harness lacks browser automation: <title> at
  <company>; user to apply manually" — the same
  applied_jobs/review-queue/record-event/Discord flow as every
  other needs_review outcome. **Never** silently skip such a job,
  never attempt a browser apply without browser tools, and never
  fork the business logic to compensate.
- A degraded harness must not degrade the core: if a capability gap
  cannot be routed to `needs_review`, stop and report rather than
  improvising a weaker flow.

## Session start checklist
1. Run `python3 scripts/state/job_state.py ensure-files` — create/validate the
   canonical registry (data/job_registry.json) and local event log.
2. Read data/applied_jobs.json — build your dedup set.
3. Read data/job_registry.json — build your canonical dedup set.
4. Read config/targets.json — load role_keywords, level_keywords, locations.
5. Confirm Playwright MCP is available before starting browser-based steps.

## Board-specific fetch method
- Ashby and Lever: use bash/curl to call the public JSON API directly.
  No authentication required. Do not use Playwright for these two boards.
    - Ashby: GET https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
      for each slug in config/targets.json "ashby_company_slugs".
    - Lever: GET https://api.lever.co/v0/postings/{slug}?mode=json
      for each slug in config/targets.json "lever_company_slugs".
  Note: neither API supports server-side filtering — apply the role/level
  filter below client-side after fetching.
- If "ashby_company_slugs" or "lever_company_slugs" in config/targets.json
  is empty, missing, or contains only placeholder values (e.g.
  "REPLACE_ME"), skip that board for this run and log a single warning to
  the session output — do not abort the run. Other boards continue
  normally. Note this state is normally short-lived: the config
  validator auto-seeds placeholder-only slug arrays from the
  project-owned vetted lists (config/ashby_vetted_slugs.json,
  config/lever_vetted_slugs.json) via scripts/validate/seed_vetted_slugs.py —
  it never overwrites an array containing any real slug. Never edit
  the vetted lists at run time; additions are reviewed code changes.
- SimplifyJobs: use the deterministic fetch helper — never scrape GitHub
  with Playwright:
  `python3 scripts/jobs/fetch_simplify_listings.py`
  The helper reads config/targets.json "simplify_feeds" (known feeds:
  "summer_internships", "new_grad"), fetches the project-owned
  SimplifyJobs listings JSON from raw.githubusercontent.com, filters to
  active + visible postings, and prints one raw-job JSON object per line
  on stdout (source "simplify"), ready for canonicalize.
  - If "simplify_feeds" is missing, empty, or placeholder-only
    ("REPLACE_ME"), the helper warns on stderr, prints nothing, and
    exits 0 — skip the board for this run and continue with the other
    boards. A non-zero exit means every configured feed failed to
    fetch: log one warning, skip the board, continue the run.
  - SimplifyJobs listings carry NO JD text. After role filtering and
    BEFORE running the fit gate, fetch the JD body from the listing's
    `url`: if the URL is an Ashby/Lever posting use those public JSON
    APIs, otherwise open the URL with Playwright and extract the JD
    text. Re-canonicalize/upsert the record with the fetched jd_text.
    Never run the fit gate on a SimplifyJobs job with empty jd_text —
    an empty JD skips every deterministic hard-reject check.
  - The helper's `sponsorship` field is informational/audit-only. Do
    not filter on it — the phase 4 fit gate is the only classifier.
- Workday (phase 7, REVIEW-ONLY): tenants are configured in
  config/targets.json "workday_tenants" as "<host>/<site>" strings —
  the tenant is the unit of configuration; board URLs follow
  `https://<company>.wd<n>.myworkdayjobs.com/<site>` (each company
  tenant differs in subdomain and site name). Use the deterministic
  fetch helper — it calls the tenant's public, auth-free CXS JSON
  endpoints; only fall back to Playwright on a posting when the helper
  fails for it:
  `python3 scripts/jobs/fetch_workday_listings.py --search "intern" --limit 200`
  One raw-job JSON object per line (source "workday"), ready for
  canonicalize.
  - Missing/empty/placeholder "workday_tenants" → helper warns, prints
    nothing, exits 0; skip the board, continue the run. Non-zero exit
    (every tenant failed) → one warning, skip, continue.
  - Listings carry NO JD text. After role filtering and BEFORE the fit
    gate, fetch the JD per surviving candidate with
    `python3 scripts/jobs/fetch_workday_listings.py --jd-url '<posting-url>'`
    and re-canonicalize/upsert with the fetched jd_text. Never fit-gate
    a Workday job with empty jd_text.
  - **No auto-apply path exists for Workday.** A Workday job whose fit
    gate returns "candidate" routes to needs_review (applied_jobs +
    review_queue + record-event + needs_review Discord notification)
    with reasoning "Workday review-only path: <title> at <company>;
    user to apply manually". Never tailor, never form-fill, never
    submit a Workday application. needs_review items are not
    applications and do not count against the 25-per-session cap.
- LinkedIn, Indeed, Handshake, Greenhouse, Wellfound: use Playwright MCP for
  browser-based scraping.

## Role filtering (apply to all boards, regardless of fetch method)
- A job title is a candidate if it contains AT LEAST ONE term from
  config/targets.json "role_keywords" AND AT LEAST ONE term from
  "level_keywords" — case-insensitive substring match, not exact match.
- If a title matches role_keywords but NONE of level_keywords, check the JD
  body text for level_keywords terms before rejecting — some postings put
  seniority only in the description, not the title.
- Hard rejects (3+ years required with no new-grad language, out of US
  scope) are enforced deterministically by the fit gate — see
  "Deterministic JD fit gate" below. Role filtering only does the
  keyword screen; it does not manual-heuristic reject.
- SEASON IS NOT A FILTER. Internships and co-ops in ANY season (summer,
  fall, spring, winter, off-cycle, year-round) are in scope. Do not skip
  or deprioritize a posting because it says "Fall 2026 Intern" or
  "Off-Cycle Internship" instead of "Summer". Use config/targets.json
  "season_keywords" only as a reference list of terms that should NOT
  cause rejection — never as a list to filter for or require.
- There is no company exclusion list — every company is in scope as long
  as the role/level keyword match passes.
- For new-grad (non-internship) roles, ignore season language entirely —
  it doesn't apply to full-time postings.

## Deterministic JD fit gate
- After role filtering and before tailoring, run the deterministic fit
  helper on every canonical job:
  `python3 scripts/jobs/evaluate_job_fit.py '<canonical-job-json>'`
  Pass the canonical job JSON (the same object upserted into the
  registry). The helper returns a JSON object with at least fit_status,
  fit_score, reasoning, fit_reasons, matched_role_keyword,
  matched_level_keyword, matched_level_source, years_required, and
  decision_version.
- The fit gate makes the status choice deterministically: use
  skipped_unfit for explicit hard rejects or clearly too-low fit,
  needs_review for borderline or ambiguous-but-promising jobs, and
  candidate otherwise.
- If the fit helper exits non-zero, returns invalid JSON, or returns an
  unexpected fit_status, treat the job as needs_review: append to
  data/applied_jobs.json and data/review_queue.json, record a
  needs_review event, and send the needs_review Discord notification.
  Do not proceed to tailoring or application when the helper result is
  unusable.
- Handle the helper output:
  - skipped_unfit — the job is clearly unfit (the helper's deterministic
    hard reject, e.g. 3+ years required, out of US scope). Record a
    local-only skipped_unfit event via record-event using the helper's
    reasoning. Do not send to Discord, do not append to
    data/applied_jobs.json, do not sync to the Google Sheet, and do not
    tailor. This replaces the manual 3+ years / out of US hard-reject
    check — the fit helper is the deterministic gate.
  - needs_review — the job is ambiguous and needs manual review before
    application. This is a user-visible manual-review outcome that
    occurs before any application submission. Do not tailor. Append a
    needs_review entry to data/applied_jobs.json (File write discipline
    schema; reasoning from the helper), append to
    data/review_queue.json, record a needs_review event via
    record-event, and invoke @discord-reporter with the needs_review
    route.
  - candidate — the job passes the fit gate. Proceed to @resume-tailor.
- The fit gate runs BEFORE resume-tailoring. Never send a skipped_unfit
  or needs_review job into tailoring — the fit gate is the deterministic
  cutoff that keeps low-quality candidates out of the review queue and
  out of tailoring.

## Handshake-specific handling
- Handshake requires a student login session. If Playwright cannot
  authenticate, skip Handshake and log one "handshake_auth_needed" entry to
  data/review_queue.json via the state helper (see File write discipline) —
  do not retry in a loop.

## Location handling
- "preferred_locations" in config/targets.json is a PRIORITY list, not a
  filter. Any job matching role_keywords + level_keywords is in scope
  regardless of location, as long as it's within "fallback_scope"
  (United States, including remote-US roles).
- Process and apply to preferred_locations matches first within each
  scraping batch. After preferred matches are exhausted for a board,
  continue processing remaining US-based matches normally — do not skip
  them and do not stop the batch early.
- Reject only if the posting is explicitly located outside the United
  States with no remote-US option (e.g. "London, UK" with no remote
  flexibility for US-based candidates).
- When logging to data/applied_jobs.json, record `location_tier` for each
  entry: "preferred" if the job's location matched a preferred_locations
  entry, or "fallback" if it was applied to under the US-wide fallback
  scope. This field is required by the File write discipline schema.

## Canonical registry and event log
- The canonical helper (scripts/state/job_state.py) is the single source of truth
  for canonical job records and internal events. Never hand-write
  data/job_registry.json or the local event log — always go through the
  helper.
- Canonicalize every scraped raw job into one internal record before any
  dedup or filtering decision:
  `python3 scripts/state/job_state.py canonicalize '<raw-job-json>'`
  Pass the raw job (company, title, url, source, jd_text, location, etc.)
  as a single JSON object string. The helper returns a canonical job JSON
  with a stable job_key (the canonical identity) and a job_id. job_id is
  "{source}-{external_job_id}" when an external id is available, otherwise
  the job_key.
- The canonical record also carries `apply_url` and `normalized_apply_url`
  — the ATS's direct application-form link (e.g. Ashby's `.../application`
  page), distinct from the generic job-listing `url`. Whenever you write a
  needs_review/applied/failed entry to data/applied_jobs.json or
  data/review_queue.json (see "File write discipline"), or populate a
  Discord "Apply URL" field, carry `apply_url` forward from the canonical
  record: use `normalized_apply_url` if non-empty, else fall back to `url`.
  Keep the existing `url` field on those entries too — it still records
  where the posting was found; `apply_url` is additive, not a replacement.
- Upsert each canonical record into the registry:
  `python3 scripts/state/job_state.py upsert-job '<canonical-job-json>'`
  The helper merges by job_key — existing records are updated, new records
  are inserted. Never append duplicates manually.
- Before any application attempt, re-check eligibility:
  `python3 scripts/state/job_state.py can-apply '<canonical-job-json>'`
  This is the dedupe recheck against the registry and applied history. If
  the helper refuses (returns non-zero or prints "no"), skip the job and
  record a skipped_unfit event. Do not attempt the application.
- Record internal events for every outcome:
  `python3 scripts/state/job_state.py record-event '<event-json>'`
  Status values and when to use them:
    - skipped_unfit — a hard reject during filtering (3+ years, out of US
      scope, etc.), a skipped_unfit from the deterministic fit gate
      (pre-tailoring or pre-apply), or a can-apply refusal right before
      applying. Local-only: never route to Discord or
      data/applied_jobs.json.
    - applied — application submitted successfully.
    - needs_review — application could not be completed (CAPTCHA, missing
      form fields, ATS score too low, etc.), or a needs_review from the
      deterministic fit gate (ambiguous job, pre-tailoring or pre-apply).
      Every user-visible needs_review outcome — including ones that occur
      before a real application submission, such as an ATS score below
      threshold during tailoring or a needs_review from the fit gate —
      must also be appended to data/applied_jobs.json so future runs do
      not re-tailor the same job forever. skipped_unfit is local-only and
      never written to applied_jobs.json.
    - failed — application submitted but errored or was rejected by the
      form.
  The event JSON must include: job_key and status (applied, needs_review,
  failed, or skipped_unfit). Include company, title, url, and reasoning
  (for needs_review, failed, skipped_unfit) for auditability. The helper
  stamps recorded_at if omitted.
- skipped_unfit is local-only. It exists for auditability of hard rejects
  but must never appear in Discord notifications or data/applied_jobs.json.
  The @discord-reporter subagent must not be invoked for skipped_unfit
  events.

## File write discipline
- applied_jobs.json entries must include: job_id, company, title, url,
  apply_url, date_applied, status (applied|failed|needs_review), role_type
  (internship|new_grad), source (linkedin|indeed|greenhouse|lever|
  wellfound|handshake|ashbyhq|simplify|workday|smartrecruiters|amazon|
  oracle), resume_used
  (swe|ai_ml|balanced|cyber|networking_cyber),
  ats_score (number), location_tier (preferred|fallback),
  cover_letter_used (bool). review_queue.json entries must also include
  apply_url alongside url. `apply_url` is the canonical record's
  `normalized_apply_url` (falling back to `url` when empty) — the direct
  application-form link, not just the job listing; see "Canonical
  registry and event log" above. When status is "failed" or "needs_review",
  a "reasoning" field is also required — a specific, one-sentence
  explanation of why the application failed or needs review (e.g.
  "ATS score 38/100 — requires CISSP certification not present in
  resume"). Never leave this field empty or generic. The "reasoning"
  field is optional when status is "applied".
- Never overwrite the file — always append new entries.
- Use the deterministic state helper for all JSON state writes — never
  hand-write jq one-liners to mutate state files directly. The helper
  handles atomic write, array append, and dedup guard.
  - Append to applied_jobs.json:
    `bash scripts/state/append_state_entry.sh data/applied_jobs.json '<entry-json>'`
  - Append to review_queue.json:
    `bash scripts/state/append_state_entry.sh data/review_queue.json '<entry-json>'`
  - Pass the entry as a single JSON object string. Do not construct tmp
    files or mv commands yourself.
- Canonical registry and event log writes go through the canonical helper
  (scripts/state/job_state.py), not append_state_entry.sh:
  `python3 scripts/state/job_state.py upsert-job '<canonical-job-json>'`
  `python3 scripts/state/job_state.py record-event '<event-json>'`
  See "Canonical registry and event log" above for the full flow.

## Scheduler (phase 8)
- The production cadence is a launchd user agent (macOS) running
  scripts/runtime/run_job_agent.sh every 30 minutes, 24/7 — managed by
  scripts/runtime/scheduler.sh (install|uninstall|status|plist); Linux
  equivalent documented in docs/SETUP.md 2.5. The runner owns overlap
  protection (skip-on-overlap, dead-lock reclaim, 60-min hung-run
  threshold), writes the machine-parseable
  "run_job_agent: complete ..." health marker, and updates
  logs/heartbeat.json after every run. The 25-per-session cap is
  unchanged by the cadence.

## TUI surface (phase 13)
- The TypeScript TUI in app/ is a rendering/orchestration overlay only.
  The Python/bash helpers remain the sole authoritative state writers:
  the TUI shells out to append_state_entry.sh and job_state.py for every
  state mutation and never edits state JSON directly. A TypeScript port
  of the core is a separate, explicitly-approved future decision.
- The review-queue file stays append-only: TUI triage records outcomes
  (applied_jobs append + record-event) and derives "resolved" from
  them — it never deletes queue entries.

## Browser extension surface (phase 10)
- The Manifest V3 extension in extension/ is the user-driven hybrid
  mode: the USER browses postings and submits forms; the extension only
  autofills, shows the fit verdict, and records outcomes.
- The extension NEVER submits a form. Autofill stops at a filled form;
  the user reviews and clicks submit themselves. This is the defining
  safety property of hybrid mode — never weaken it.
- Autofill values come ONLY from config/targets.json "safe_fields". A
  field the profile cannot answer is highlighted for the user, never
  invented. The bridge serves only the specific keys a page's form
  mapped — never the whole safe_fields map.
- All extension reads/writes flow through scripts/runtime/extension_bridge.py
  (localhost-only, per-install bearer token in the gitignored
  config/extension_bridge.json). The bridge itself only shells out to
  the standard helpers (job_state.py, evaluate_job_fit.py,
  append_state_entry.sh, sync_internship_tracker.py) — the same write
  discipline as the agent and the TUI, so hybrid-mode and agent-mode
  applications dedupe against each other in the same job_key space.
- Extension-recorded outcomes are "applied" (after the user confirms
  they submitted) and "needs_review" (save for later). The applied
  path re-checks can-apply before writing and syncs the tracker
  best-effort, mirroring the agent path.
- ATS selector fixups live in extension/src/ats.ts only — one
  reviewable module for all four families (Greenhouse, Lever, Ashby,
  Workday). Web-store distribution is out of scope (load unpacked).

## Internship tracker (Google Sheets) sync
- The Google Sheet internship tracker is a user-facing record of
  successful applications. Sync is one-way (agent → sheet) and
  append-only: each successful application adds exactly one row.
- Sync ONLY outcomes with status "applied". needs_review, failed, and
  skipped_unfit must never be written to the sheet — those are internal
  or review-only outcomes.
- Sync happens exactly once per successful application, and only AFTER
  the applied_jobs.json entry is appended and the internal "applied"
  event is recorded via record-event. Do not sync before those writes
  succeed.
- The sheet is user-facing: the sync payload must contain only the
  current visible tracker fields. Never send internal-only fields
  (job_key, external_job_id, normalized_url, normalized_apply_url,
  ats_system, ats_score, resume_used, location_tier, cover_letter_used,
  reasoning, sources, first_seen_at, last_seen_at, latest_status,
  role_type) to the sheet.
- Invoke the helper with a single JSON payload describing one successful
  application:
  `python3 scripts/jobs/sync_internship_tracker.py '<row-json>'`
  The payload carries the visible tracker row fields (JSON keys match
  the helper's accepted payload fields):
    - company (required) — the applied job's company.
    - title (required) — the applied job's title.
    - date_applied (optional) — the actual application date (see
      below). Defaults to today if omitted.
    - internship_term (optional) — derived per the rules below.
    - notes (optional, user-facing only) — a short note for the Notes
      column. Leave blank unless there is something specific worth
      surfacing to the human reader; never put internal reasoning here.
  The helper auto-fills the remaining visible columns (Status, Response
  Received, Date of Response) — do not send those. Source and URL are
  not visible tracker columns and the helper does not read them; do not
  include them in the payload.
- Internship Term population (in priority order):
    1. Use the canonical job record's `internship_term` if it is
       non-empty.
    2. Otherwise, infer a term from the job title and JD text ONLY when
       a clear term is present (e.g. "Summer 2026", "Fall 2026 Intern",
       "Spring Co-op"). Use config/targets.json "season_keywords" as
       the reference set of recognizable terms. Do not guess or
       fabricate a term.
    3. Otherwise, leave Internship Term blank.
- Date Applied is the actual application submission date — the
  `date_applied` value written to the applied_jobs.json entry —
  formatted as YYYY-MM-DD (a format Google Sheets recognizes as a
  date). Never use the sync timestamp in place of the real application
  date.
- If the helper reports that sync is disabled or unconfigured (e.g.
  missing credentials or sheet id), or exits non-zero for any reason,
  log a single warning to the session output and continue. The
  application run is still successful — do not treat a disabled,
  unconfigured, or non-zero-exit sync as a failed outcome, and do not
  retry in a loop.
- Out of scope (do not add): reverse sync (sheet → agent), extra machine
  or internal tabs, backfilling Notes or Status into existing rows, or
  any future-phase behavior beyond appending one row per successful
  application.
