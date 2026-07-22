# aplyx app integration — progress notes

Working log for the Phase 11 (hosted Supabase backend) + Phase 14A
(Tauri desktop app shell) build. Companion to
[`docs/app-integration-plan.md`](./app-integration-plan.md) (the
original plan) — this file tracks what actually shipped, what
deviated from that plan and why, what's left, and operator actions
still outstanding. Update this file as the work continues; it is not
a substitute for the phase write-ups in `docs/PLAN.md` §3.12/§3.15,
which remain the canonical record.

## Status at a glance

| Piece | Status |
|---|---|
| Shared core extraction (`packages/core`) | Done |
| Supabase schema + RLS + storage bucket | Done, applied to the operator's live project |
| `Adapter` interface (`LocalAdapter` / `SupabaseAdapter`) | Done |
| Desktop app shell (Tauri + React) | Done |
| Entry screen, local wizard, hosted wizard | Done |
| Home / Settings screens | Done (real) |
| Jobs / Review / History / Resumes screens | Not done — Phase 14B, deferred |
| Email/password + Google auth | Done, code-complete |
| Deep-link auth callback (`aplyx://auth-callback`) | Done, verified at the OS level on macOS |
| `config/supabase.json` populated | Done (operator did this) |
| Migration `0001_init.sql` applied to the live Supabase project | Done (operator ran it via SQL Editor) |
| Migration `0002_onboarding_completed.sql` applied to the live project | **Not done yet — blocks the skip-wizard fix below from working live** |
| Google OAuth client configured in Supabase | Not done yet |
| Redirect URL `aplyx://auth-callback` added in Supabase dashboard | Not done yet — next step |
| End-to-end sign-up verified working | Not yet confirmed — pending the redirect URL step above |
| Custom SMTP (Resend or Gmail app-password) | Not done yet — Supabase's built-in mailer is unreliable/rate-limited, flagged to operator |

## What shipped

### Shared core (`packages/core`)

Extracted from `app/src/` (the TUI) into a real npm-workspace package,
`@aplyx/core`, so the TUI and the desktop app share one
implementation instead of two:

- `state.ts`, `helpers.ts`, `settings.ts`, `platform.ts`, `project.ts`,
  `harness.ts`, `profileLinks.ts`, `companyTargets.ts`, `data/*.ts` —
  moved as-is (all already framework-agnostic, no Ink/React imports).
- `onboarding/fields.ts` — the 8-page/18-field onboarding schema,
  moved from the TUI's `ui/onboarding/pages.ts` so both wizards render
  identical fields.
- `onboarding/profile.ts` — local-mode field read/write routing
  (fs-backed, `LocalAdapter`-only).
- `onboarding/hostedFields.ts` — **deliberately split out** from
  `profile.ts` so importing it (for `SupabaseAdapter`) never
  transitively pulls in `node:fs`. Caught by a Vite build warning
  during development ("Module node:fs has been externalized for
  browser compatibility") — the split fixed it; a clean Vite build
  with no externalization warnings is the regression check.
- `bridge.ts` — the local-mode IPC dispatcher. Not imported directly;
  compiled to `dist/bridge.js` and spawned as a subprocess by the Rust
  side (see below).
- `adapter.ts` + `adapters/local.ts` + `adapters/supabase.ts` — the
  storage-adapter seam. `LocalAdapter` wraps the same Python-helper
  calls the TUI already makes; `SupabaseAdapter` is pure
  `@supabase/supabase-js` with zero Node-API dependency, so it runs
  directly in the Tauri webview.

`app/`'s imports were rewritten to `@aplyx/core/*` in place — no
duplication. Verified by `npm run smoke --workspace=app` passing
unchanged after the move.

### Supabase backend

`supabase/migrations/0001_init.sql`:

- `profiles`, `jobs`, `job_events`, `applied_jobs`, `review_queue`
  tables, one-to-one with the local JSON shapes in
  `packages/core/src/state.ts`.
- A private `resumes` Storage bucket, RLS-scoped to a
  `<user_id>/...` folder prefix.
- Every table/bucket policy is `auth.uid() = user_id` (or the
  folder-prefix equivalent for storage) for every allowed operation;
  `job_events` and `review_queue` have no update/delete policy
  (append-only, matching the local files' discipline).
- A `jobs_guard_status_transition` trigger mirrors
  `scripts/state/job_state.py`'s `record_event()` never-downgrade
  rule, so a sync can't silently regress a blocking status
  (`applied`/`needs_review`/`failed`/`skipped_unfit`) back to
  `new`/`seen`.

**Applied to the operator's live project** (org created, project ref
`rblahgiizkmqauwsyrry`) by pasting the migration SQL into the Supabase
SQL Editor — confirmed built successfully.

**Deliberate deviations from the original Phase 11 plan**, both
explicit operator decisions (see `docs/PLAN.md` §3.12 for the full
reasoning):
- **Password auth, not magic-link-first.** The plan's original default
  was email magic-link; the operator asked for email/password
  specifically.
- **Profile PII synced to `profiles`, not kept local-only.** The
  plan's original default was `safe_fields`-shaped PII (name, contact,
  work authorization, etc.) staying client-side and never hosted. The
  operator explicitly overrode this so a signed-in user's profile
  follows them across devices. Job-search *preferences*
  (role_keywords/preferred_locations/target_companies) still go in a
  separate `preferences` jsonb column rather than columns of their
  own, since they're not PII and only become useful once synced back
  into a local install's `config/targets.json` for the Python
  fit-gate engine (Phase 14B, not yet built).

### Desktop app (`desktop/`)

Tauri v2 + React 19 + Vite, scaffolded via `create-tauri-app`.

**Local mode never touches `node:fs`/`child_process` from the
frontend.** The webview calls narrow, typed `#[tauri::command]`s
(`desktop/src-tauri/src/lib.rs`), which spawn
`packages/core/dist/bridge.js <cmd> <jsonArgs>` over stdio — a
subprocess, not a localhost server — reusing the exact `LocalAdapter`
functions the TUI already uses.

**Hosted mode's frontend calls Supabase directly** via
`@supabase/supabase-js` (no Rust round-trip needed for hosted reads/
writes, since `SupabaseAdapter` is browser-safe).

Screens:
- **Entry screen** (`routes/EntryScreen.tsx`) — landing-style chooser,
  Run locally / Sign in, both real.
- **Auth screen** (`routes/auth/AuthScreen.tsx`) — email/password
  sign-in/sign-up tabs + "Continue with Google," with an
  "unconfigured" fallback state if `config/supabase.json` is missing/
  placeholder.
- **Local onboarding wizard** (`routes/onboarding/local/`) — Welcome →
  Environment checks (runs the validator) → coding-agent detect/
  select → the 8 shared profile field-pages → resume import + PDF-to-
  markdown convert → Discord notification setup → browser-extension
  folder → review/finish. Every write goes through `LocalAdapter`.
- **Hosted onboarding wizard** (`routes/onboarding/hosted/`) — sign-in
  confirmation → import local profile data or start fresh → the same
  8 shared field-pages via `SupabaseAdapter` → resume upload to
  Supabase Storage → finish.
- **App shell** (`routes/shell/`) — persistent nav: Home, Jobs, Review
  queue, History, Resumes, Settings. **Home** (pipeline summary counts
  via `LocalAdapter.loadState()`, mode indicator) and **Settings**
  (account/session info, sign-out, local-install path, reopen-setup
  link) are real. Jobs/Review queue/History/Resumes render an
  explicit "coming in the next update" placeholder — that's Phase
  14B, intentionally not built in this pass.

**Design system + logo**: `desktop/src/styles/tokens.css` — warm
neutral canvas (cream/charcoal), one violet-plum accent, system-font
stack (no bundled/CDN fonts — works fully offline), light+dark via
`prefers-color-scheme` plus an explicit `data-theme` override. Logo is
a hand-authored SVG "signal" mark (three concentric arcs radiating
from a point — `desktop/src/assets/logo-mark.svg`), rasterized and run
through `tauri icon` for the full app-icon set (icns/ico/PNG/mobile
variants).

### Auth deep-link fix (2026-07-16, post-first-test-run)

First live test hit a real gap: Supabase's confirmation email and the
Google OAuth flow both redirect to a plain URL (default
`http://localhost:3000`), but a desktop app isn't a website sitting
there to receive it — the click landed on a dead local page and the
account was never confirmed.

Fixed with the standard desktop-app pattern (same one Slack/VS Code/
GitHub Desktop use): a registered custom URL scheme.

- `desktop/src-tauri/Cargo.toml` — added `tauri-plugin-deep-link`.
- `desktop/src-tauri/tauri.conf.json` — `plugins.deep-link.desktop.schemes: ["aplyx"]`.
- `desktop/src-tauri/capabilities/default.json` — added
  `deep-link:default` permission.
- `desktop/src/lib/AuthContext.tsx` — `AUTH_CALLBACK_URL =
  "aplyx://auth-callback"`; `signUpWithPassword` passes it as
  `emailRedirectTo`; `signInWithGoogle` uses `skipBrowserRedirect:
  true` and opens the OAuth URL in the *system* browser via
  `@tauri-apps/plugin-opener`'s `openUrl` (Google blocks OAuth from
  embedded webviews, so the webview must not navigate itself); an
  `onOpenUrl` listener catches the OS routing the click back to the
  app and calls `client.auth.exchangeCodeForSession(url)` to finish
  the session, for both the email-confirmation and Google-OAuth paths.

**Verified at the OS level**: built a real `.app` bundle
(`npm run tauri build -- --debug`), installed it to `/Applications`
(required — macOS only recognizes a custom URL scheme once the app is
bundled and installed there; `tauri dev`'s raw binary can't register
it), launched it once, and confirmed via `lsregister -dump` that
macOS claims `aplyx:` for the bundle. Fired a test `open
"aplyx://auth-callback?test=1"` — routed silently to the running app
with no browser tab opening and no crash. **Not yet verified**: an
actual real sign-up completing end-to-end (the Supabase dashboard
still needs the redirect URL added — see Next steps).

**Known limitation, not yet addressed**: this only works on macOS as
built. On Windows/Linux, `tauri-plugin-deep-link` docs are explicit
that a deep-link click spawns a *new* app instance with the URL as a
CLI arg rather than routing into the already-running one — shipping
cross-platform needs `tauri-plugin-single-instance` added on top to
forward the URL into the existing instance. Flagged in a code comment
in `lib.rs`, not silently skipped.

### Sign-in hang + branding fix pass (2026-07-16, second test round)

Operator reported the auth screen stuck on "Checking sign-in
availability…" in the installed .app, plus asked for the real brand
logo and a less-orange palette. All three addressed:

**Sign-in hang — two stacked bugs, both fixed:**
- `desktop/src-tauri/src/lib.rs` — a Finder-launched .app inherits
  launchd's minimal PATH (no Homebrew/nvm/Volta), so
  `Command::new("node")` failed to spawn the core bridge in the
  installed bundle even though `tauri dev` worked. New `node_binary()`
  probes /opt/homebrew, /usr/local, /opt/local, Volta, and nvm before
  falling back to PATH.
- `desktop/src/lib/AuthContext.tsx` — the resulting rejection from
  `getSupabaseClient()` was silently dropped, stranding status on
  "checking" forever. Init now catches into a new `"error"` status
  with the real message, a Try-again (`retry()`), and a
  "Run locally instead" escape (rendered in AuthScreen). All sign-in
  methods also catch and return `{error}` instead of throwing.
- `desktop/src/lib/supabaseClient.ts` — **`flowType: "pkce"` added to
  `createClient`**. This was a third, latent bug: AuthContext finishes
  the deep-link callback with `exchangeCodeForSession()`, which only
  works under the PKCE flow — the supabase-js default (implicit) puts
  tokens in a URL fragment and the exchange would have failed even
  after the redirect-URL dashboard step. Also stopped caching the
  "unconfigured" result so adding config/supabase.json no longer needs
  an app restart.
- Same stranded-loading pattern swept app-wide: HostedWizard,
  HomeScreen, EnvironmentStep, CodingAgentStep, NotificationsStep,
  ProfileStep, HostedProfileStep all now settle their loading states
  on failure. AuthScreen auto-navigates to /onboarding/hosted when the
  deep-link callback flips status to signed-in.
- Verified: bridge CLI round-trips (`findRoot`, `readSupabaseConfig`),
  Supabase project healthy (auth/v1/health 200, email auth on, Google
  provider still off), fresh debug bundle installed to /Applications,
  `aplyx://auth-callback?test=1` routes into the running instance
  (single process, no crash). End-to-end sign-up still pending the
  dashboard redirect-URL step below.

**Logo** — replaced the placeholder "signal arcs" mark with the real
brand mark: dark rounded badge, pixel-block letter A fading lavender →
purple → violet → pink with circuit traces (recreated as hand-authored
SVG in `Logo.tsx` + `assets/logo-mark.svg` + `public/favicon.svg`;
full Tauri icon set regenerated via `tauri icon` from a 1024px
rsvg-convert render). Wordmark now renders "aplyx" with the pink "r".

**Palette** — `styles/tokens.css` reworked from the warm cream/orange
neutrals to the TUI's language (app/src/theme.ts): violet accent
(#7C3AED light / #A78BFA dark, i.e. the BANNER_GRADIENT family), cool
violet-tinted neutrals, dark mode anchored to the logo badge's
near-black plum, plus a reserved `--pink` brand token. No other CSS
file carried hardcoded colors, so the retheme is fully token-driven.

### Second operator feedback round (2026-07-16, evening)

Operator feedback: logo still wrong (it's a block lowercase "a", not my
capital-A reading), sign-up email never arrives, coding-agent detection
flaky (~50%), wants searchable tag-style company/location preferences,
a theme setting (system/light/dark, beige light), and a font setting
(bundled Geist; default UI font stays system).

- **Logo redone faithfully** — cropped and studied the operator's brand
  image, re-traced the geometry: 4-tile lavender apex bar, offset
  3-tile purple row + raised 2-tile purple stem block, wide violet
  blocks, pink feet, square-cornered double-line traces. Same files
  regenerated (Logo.tsx, logo-mark.svg, favicon.svg, full tauri icon
  set).
- **Sign-up email diagnosed live**: REST signup against the operator's
  project returns 200 with confirmation_sent_at set — Supabase IS
  dispatching. Two real issues: (1) Supabase's built-in mailer is
  best-effort, ~2 emails/hour, spam-prone — custom SMTP in the
  dashboard is the durable fix; (2) retrying "Create account" with an
  already-registered unconfirmed email returns an obfuscated fake
  success (empty identities array) and does NOT resend — the app now
  detects that, says so, and offers a working "Resend confirmation
  email" button (auth.resend). A test signup for
  kashmoney153+applyrtest1@gmail.com was fired during diagnosis — tell
  the operator to check spam for it.
- **Agent detection fixed**: packages/core harness.ts now probes
  Homebrew//usr/local//opt/local, ~/.local/bin, ~/bin, ~/.bun/bin,
  ~/.claude/local, ~/.opencode/bin, Volta, cargo, npm-global, pnpm, and
  every nvm version bin ON TOP of $PATH — the flakiness was launchd's
  minimal PATH in the installed .app (terminal launches worked, Finder
  launches didn't). Verified under `env -i PATH=/usr/bin:...`: finds
  both opencode and claude.
- **Tag search UI**: new desktop/src/components/TagSearchInput.tsx —
  fuzzy search (filterSuggestions moved from app/src/ui/autocomplete.ts
  to packages/core/src/autocomplete.ts with a re-export shim; now
  shared TUI+desktop), Enter/arrows/click to add, chips wrap in rows
  (max-width caps ~6-7 per row), hover/focus reveals ×, Backspace on
  empty input removes last. Wired via FieldInput for multi-location
  (US_CITIES pool) and multi-company (new listCompanies bridge command
  over loadCompanyDirectory) — both wizards get it since they share
  FieldInput. Single home-location field got a native datalist over the
  same city pool. Also fixed pre-existing duplicates in US_CITIES
  (309 -> 274 entries; exact repeats across regional groupings).
- **Theme + font settings**: Settings → Appearance. Theme
  system/light/dark persisted in localStorage (aplyx.theme), applied
  as data-theme on <html> pre-first-paint (src/lib/uiPrefs.ts +
  main.tsx). Light theme re-grounded on warm beige (#f6f1e6 family) per
  operator; dark unchanged. Font system/geist (aplyx.font →
  data-font); Geist + Geist Mono variable woff2 bundled from the
  `geist` npm package (SIL OFL) — no CDN fetch. Note: the TUI's font
  cannot be set by the app — terminal emulators own their font; Geist
  Mono for the TUI is a terminal-profile setting on the user's side.
- **Verified**: core build + TUI typecheck + desktop tsc/vite all clean;
  bridge listCompanies round-trips; tag UI exercised end-to-end in a
  mocked-bridge browser session (fuzzy add via Enter, 16 chips wrapping
  ~7/row, hover-× removal, outside-click closes dropdown, zero console
  errors); theme + font toggles verified live (localStorage + data-*
  attributes); rebuilt debug bundle reinstalled to /Applications and
  `aplyx://auth-callback?test=2` routed into the single running
  instance. Also hardened ImportOrFreshStep (import failure no longer
  strands "Importing…"; error shown with start-fresh fallback).

## Deferred to Phase 14B (separate follow-up, needs its own go-ahead)

- Real Jobs (live board search), Review queue (triage), History, and
  Resumes screens, at parity with the TUI, through the same
  `LocalAdapter`/`SupabaseAdapter` seam the shell already has.
- Hosted ↔ local pipeline-state sync — `SupabaseAdapter.loadState()`
  intentionally returns `undefined` today; only the desktop wizard's
  per-field profile import (`ImportOrFreshStep.tsx`) exists, not a
  full `jobs`/`job_events`/`applied_jobs`/`review_queue` sync.
- A one-shot local→hosted migration script beyond that per-field
  profile import.
- Account-deletion tooling.
- `tauri-plugin-single-instance` for cross-platform deep-link support.

## Operator actions — what's left

1. **Add the redirect URL in Supabase** — dashboard → Authentication →
   URL Configuration → Redirect URLs → add `aplyx://auth-callback`.
   Without this Supabase rejects the redirect even though the app is
   ready to receive it. **This is the next step to unblock testing.**
2. **Apply migration `0002_onboarding_completed.sql`** — same process
   as `0001`: paste it into the Supabase SQL Editor and run it. Adds
   one `boolean not null default false` column to `profiles`; safe on
   the live project with existing rows. Blocks the skip-wizard-on-
   return-signin fix (see below) from working until applied — until
   then, `readOnboardingCompleted()`/`writeOnboardingCompleted()` will
   error since the column doesn't exist yet.
3. **Configure custom SMTP** — Supabase's built-in mailer is
   rate-limited/unreliable by design (not meant for production; see
   their own docs). Dashboard → Authentication → Emails → SMTP
   Settings. Operator is setting this up with a dedicated Gmail
   account + app password (host `smtp.gmail.com`, port `587`).
4. **Configure Google OAuth** (optional, only if "Continue with
   Google" should work) — create a Google Cloud OAuth 2.0 Client ID
   (Web application type), redirect URI
   `https://rblahgiizkmqauwsyrry.supabase.co/auth/v1/callback`, add
   the account's own email as a Test User (OAuth consent screen stays
   in Testing mode — no Google review needed for personal/beta use),
   enter the client ID/secret in Supabase → Authentication → Providers
   → Google.
5. **Re-test sign-up** using the installed `/Applications/aplyx.app`
   (not `npm run tauri dev` — the dev binary can't receive the deep
   link) and confirm the confirmation-email click actually lands back
   in the app signed in.
6. Longer-term: a Rust toolchain (`rustup`) is now a real build
   dependency for `desktop/` — not previously part of the project.
   Installed via Homebrew on this dev machine; any other machine
   building `desktop/` needs it too.

## Skip onboarding wizard on returning sign-in (2026-07-17)

Operator feedback: every sign-in replayed the full hosted wizard
(Welcome → Import/Fresh → Profile → Resume → Finish), even for a
returning user who'd already done it — and reopening the app after
being signed in dropped back to the landing "Run locally / Sign in"
chooser instead of resuming the session, even though Supabase already
persists it (`persistSession: true`). Investigation found local mode
had the identical latent bug: `readOnboardingCompleted`/
`writeOnboardingCompleted` already existed (`packages/core/src/
settings.ts`, backed by `config/onboarding.json`) and `LocalWizard`
correctly *wrote* it at finish — but nothing ever *read* it, so the
local wizard also replayed every launch regardless of prior
completion.

Fixed both:

- **New migration** `supabase/migrations/0002_onboarding_completed.sql`
  — adds `profiles.onboarding_completed boolean not null default
  false`. **Not yet applied to the live project** (operator action
  above).
- **`SupabaseAdapter`** (`packages/core/src/adapters/supabase.ts`) —
  new `readOnboardingCompleted()`/`writeOnboardingCompleted()`
  methods, same shape as the local pair.
- **`AuthContext`** (`desktop/src/lib/AuthContext.tsx`) — new
  `onboardingCompleted: boolean | undefined` in context state,
  resolved automatically via a `SupabaseAdapter` read every time the
  session changes (initial `getSession()` and every
  `onAuthStateChange` event — interactive sign-in, sign-out, the
  deep-link PKCE exchange all flow through one `applySession()`
  function instead of three copies of the same logic). `undefined`
  means "still resolving" — callers wait rather than guess. Also
  exposes `markOnboardingCompleted()` so the wizard's finish step can
  update context state immediately instead of waiting for the next
  auth event to naturally refresh it.
- **`EntryScreen`** — two independent fixes:
  - A persisted hosted session (`status === "signed-in"` on cold
    boot, before any click) now redirects straight to `/app` (or
    `/onboarding/hosted` if signup never finished the wizard) instead
    of rendering the landing chooser — the chooser is for a fresh
    device/first run, not every relaunch.
  - "Run locally" now checks `hasLocalInstall` + `readOnboardingCompleted`
    before navigating — an already-onboarded local install goes
    straight to `/app`; anything else (no install, or install not yet
    onboarded) goes to `/onboarding/local` as before.
- **`AuthScreen`** — the post-sign-in redirect (password sign-in, and
  the deep-link callback flipping status to signed-in) is now one
  effect keyed on `status`/`onboardingCompleted`, routing to `/app`
  for a returning user or `/onboarding/hosted` for a first-time one,
  instead of unconditionally hardcoding the wizard.
- **`HostedWizard`** — the "Finish" step's `goNext()` now writes
  `onboarding_completed = true` via `SupabaseAdapter` and calls
  `markOnboardingCompleted()` before navigating to `/app`.

**Verified**: core build + TUI typecheck + desktop tsc/vite all clean.
Local-mode both branches exercised live in a mocked-bridge browser
session — `Get started` with `onboarding_completed: true` lands
directly on `/app` (Home screen, no wizard rendered); with `false`
lands on `/onboarding/local` as before. **Not yet verified against the
live Supabase project** — migration `0002` needs to be applied first
(operator action above); the hosted-mode code path is otherwise
identical in shape to the already-verified local one and typechecks
against the real `SupabaseAdapter`, but wasn't exercised against a
real signed-in session this pass to avoid mutating the live test
account's row ahead of the migration existing to receive the write.
Rebuilt debug bundle reinstalled to `/Applications/aplyx.app`.

## Desktop app install, all three platforms (2026-07-17)

Operator request: all three installers (`install.sh` for macOS/Linux,
`install.ps1` for Windows) should ask whether to also install the
desktop app alongside the TUI — early-preview stage, so opt-in and
non-fatal to the main install either way. "Should work just like it
does on my MacBook" once installed.

**New standalone scripts** — the actual build/install logic didn't
belong inlined into the already-long main installers, and needed to be
independently re-runnable (a user fixing a missing Rust toolchain
shouldn't have to redo the whole TUI install to retry):
- `scripts/install/install_desktop.sh` (macOS + Linux)
- `scripts/install/install_desktop.ps1` (Windows, native PowerShell)

Each: checks for Rust (offers `rustup` install, `--profile minimal`),
checks OS-native GUI build deps Tauri needs (Xcode CLT on macOS;
webkit2gtk/build-essential-equivalent via apt/dnf/pacman on Linux;
Visual C++ Build Tools via winget on Windows, probed via `vswhere`),
builds `packages/core` → the desktop frontend → the Tauri app in
**release** mode (not the `--debug` used for local dev iteration
earlier in this project), then installs the resulting bundle:
- macOS: `/Applications/aplyx.app`, falling back to
  `~/Applications` if `/Applications` isn't writable (no sudo).
- Linux: `apt install ./*.deb` or `dnf install ./*.rpm` if available
  (resolves runtime deps automatically); else falls back to an
  AppImage + a generated `~/.local/share/applications/aplyx.desktop`
  entry so it shows up in the app launcher, matching a "real install"
  feel rather than a bare executable.
- Windows: prefers the NSIS `.exe` over the MSI specifically because
  Tauri's default NSIS template installs per-user under
  `%LOCALAPPDATA%` with **no admin/UAC prompt** — matching the
  no-elevation install the app already gets on macOS. Falls back to
  the MSI (which typically does need elevation) if no NSIS bundle was
  produced.

**Fixed a real pre-existing bug found along the way**: `packages/core`
has no `prepare`/`postinstall` hook, so its `dist/` was never built
automatically — the TUI's own install step (`build_node_surface app`)
silently relied on `packages/core/dist` already existing from a prior
build, which is never true on a genuinely fresh clone. `app`'s `tsc`
build would have failed to resolve `@aplyx/core/*` imports. Both
`install.sh` and `install.ps1` now run `npm run build:core` before
building either the TUI or the desktop app.

**PowerShell robustness**: `install.ps1` already had a documented
workaround (from earlier work, around its Python/pypdf check) for a
real gotcha — on PowerShell 7.3+ with
`$PSNativeCommandUseErrorActionPreference` on, a non-zero exit from a
native command under `$ErrorActionPreference = "Stop"` throws instead
of just setting `$LASTEXITCODE`, which would abort the whole script
instead of hitting the intended warning/fallback path. Applied the
same try/catch treatment to every new native-command call in both
`.ps1` files (npm, cargo, rustup-init, winget) — this is an opt-in,
non-fatal step and must never be able to take down the rest of the
installer.

**Uninstall** (`scripts/install/uninstall.py`) now also removes the
desktop app if present — `/Applications/aplyx.app` (or
`~/Applications`) on macOS, the AppImage + `.desktop` entry (or a
"remove via apt/dnf" hint for package-manager installs) on Linux, and
the registered per-user uninstaller via the registry on Windows. All
best-effort — never fails the overall uninstall.

**Verified end-to-end on this MacBook** (the one platform actually
testable here): cleared any prior install and the release build cache,
ran `install_desktop.sh` fresh — Rust dependency tree downloaded and
compiled clean (~78s first build, ~27s on a warm-cache re-run),
`.app` + `.dmg` bundled, installed to `/Applications/aplyx.app`,
launched and confirmed running. Also ran the full `install.sh`
non-interactively to confirm the new opt-in prompt degrades cleanly
(clear skip message, rest of the install unaffected) and doesn't
disturb any existing step. Exercised the new uninstall path in
isolation — correctly found and removed the installed `.app`; verified
uninstall→reinstall leaves a working app again.

**Not verified** (no Linux/Windows machine available in this session):
the Linux package-manager/AppImage branches and the full Windows
Rust+VC++-Build-Tools+NSIS/MSI path are implemented against Tauri's
and each package manager's documented behavior and reviewed carefully
for shell/PowerShell correctness, but haven't been run on a real
Linux or Windows machine. Flagging this clearly rather than claiming
full verification — worth a real test pass on both before this is
called done across "all three platforms."
