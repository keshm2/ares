#!/bin/bash
# install.sh — universal first-run installer (Phase 15).
#
# One command from a fresh GitHub clone to a validated, harness-configured
# setup. Non-destructive: existing live configs are never overwritten.
#
#   bash scripts/install/install.sh                                      # from a clone/unpacked release
#   curl -fsSL https://raw.githubusercontent.com/keshm2/applyr/main/scripts/install/install.sh | bash
#
# Steps:
#   0. Bootstrap: when piped (curl | bash) or run outside the repo,
#      download and unpack the source tarball, then re-run from inside it.
#   1. Check prerequisites (jq, python3; node optional for the TUI).
#   2. Copy config/*.example.json to live configs where missing.
#   3. Detect installed coding agents (opencode, claude) and write
#      config/harness.json (only if missing).
#   4. Ask for the user's profile (safe_fields) — kept locally only.
#   5. Offer to create .claude/settings.json (headless permission
#      pre-approval) when Claude Code is the harness — asks first.
#   6. Regenerate per-harness agent definitions from agents/.
#   7. Run the config validator (which also auto-seeds vetted slugs).
#   8. Optionally build the TUI (app/) when node is available.

set -euo pipefail

say()  { echo "install: $*"; }
warn() { echo "install: WARNING: $*" >&2; }
fail() { echo "install: ERROR: $*" >&2; exit 1; }

# Colors only on a TTY; the privacy notice and warnings must stand out.
if [ -t 1 ]; then
  C_NOTICE=$'\033[1;36m'; C_WARN=$'\033[1;33m'; C_RESET=$'\033[0m'
else
  C_NOTICE=""; C_WARN=""; C_RESET=""
fi

# --- 0. Bootstrap (curl | bash, or run outside the repo) ----------------------
# When the script is piped, BASH_SOURCE is empty and there is no repo around
# it. Download the source tarball, unpack, and re-exec from inside it.
# (The npm-installed `applyr` command mirrors this bootstrap; its own
# --no-core flag / APPLYR_SKIP_CORE=1 opt-out has no equivalent here since
# this script IS the install.)
SELF="${BASH_SOURCE[0]:-}"
if [ -n "$SELF" ] && [ -f "$(dirname "$SELF")/../../AGENTS.md" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
  command -v curl >/dev/null 2>&1 || fail "curl is required for the one-line install"
  command -v tar  >/dev/null 2>&1 || fail "tar is required for the one-line install"
  TARGET_DIR="${APPLYR_HOME:-$HOME/applyr}"
  if [ -f "$TARGET_DIR/AGENTS.md" ]; then
    say "existing install found at $TARGET_DIR — refreshing it from GitHub before re-running."
  else
    say "downloading applyr into $TARGET_DIR …"
  fi
  mkdir -p "$TARGET_DIR"
  # Always re-fetch and overwrite tracked files, even for an existing install:
  # heals a stale or corrupted local copy (e.g. an old script version with a
  # bug) instead of re-running whatever happens to already be on disk.
  # Gitignored local state (config/*.json, data/, logs/, docs/PLAN.md)
  # isn't in the tarball, so it's left untouched.
  curl -fsSL "https://codeload.github.com/keshm2/applyr/tar.gz/refs/heads/main" \
    | tar -xz --strip-components=1 -C "$TARGET_DIR"
  # Re-attach stdin to the terminal so the interactive prompts below work
  # even though the script itself arrived on stdin.
  if [ -e /dev/tty ]; then
    exec bash "$TARGET_DIR/scripts/install/install.sh" </dev/tty
  else
    exec bash "$TARGET_DIR/scripts/install/install.sh"
  fi
fi
cd "$PROJECT_ROOT"

# --- 1. Prerequisites --------------------------------------------------------
# Detect everything missing FIRST (tools + the one required Python package,
# pypdf — resume PDF conversion silently can't work without it) and ask
# once, rather than hard-failing on the first missing thing: most users
# running the one-liner have no idea what jq/python3/pypdf even are, and
# would rather applyr just installed them.
MISSING_TOOLS=""
command -v jq      >/dev/null 2>&1 || MISSING_TOOLS="$MISSING_TOOLS jq"
command -v python3 >/dev/null 2>&1 || MISSING_TOOLS="$MISSING_TOOLS python3"
MISSING_TOOLS="${MISSING_TOOLS# }"

MISSING_PY_PKGS=""
if command -v python3 >/dev/null 2>&1; then
  python3 -c "import pypdf" >/dev/null 2>&1 || MISSING_PY_PKGS="pypdf"
fi

if [ -n "$MISSING_TOOLS" ] || [ -n "$MISSING_PY_PKGS" ]; then
  echo
  [ -n "$MISSING_TOOLS" ]  && warn "not detected: $MISSING_TOOLS"
  [ -n "$MISSING_PY_PKGS" ] && warn "not detected (Python package): $MISSING_PY_PKGS — needed for resume PDF conversion"
  warn "these are needed to continue installing applyr."
  INSTALL_DEPS="y"
  if [ -t 0 ]; then
    printf "Install them now? [Y/n] "
    read -r INSTALL_DEPS || INSTALL_DEPS="y"
    [ -z "$INSTALL_DEPS" ] && INSTALL_DEPS="y"
  else
    warn "non-interactive install — proceeding to install them automatically (re-run interactively to be asked first)."
  fi
  case "$INSTALL_DEPS" in
    y|Y) ;;
    *) fail "cannot continue without: ${MISSING_TOOLS}${MISSING_TOOLS:+, }${MISSING_PY_PKGS}. Install them yourself and re-run." ;;
  esac

  if [ -n "$MISSING_TOOLS" ]; then
    SUDO=""
    [ "$(id -u 2>/dev/null || echo 0)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"
    if command -v brew >/dev/null 2>&1; then
      brew install $MISSING_TOOLS || fail "failed to install $MISSING_TOOLS via brew — install manually and re-run."
    elif command -v apt-get >/dev/null 2>&1; then
      $SUDO apt-get update && $SUDO apt-get install -y $MISSING_TOOLS \
        || fail "failed to install $MISSING_TOOLS via apt-get — install manually and re-run."
    elif command -v dnf >/dev/null 2>&1; then
      $SUDO dnf install -y $MISSING_TOOLS || fail "failed to install $MISSING_TOOLS via dnf — install manually and re-run."
    elif command -v yum >/dev/null 2>&1; then
      $SUDO yum install -y $MISSING_TOOLS || fail "failed to install $MISSING_TOOLS via yum — install manually and re-run."
    elif command -v pacman >/dev/null 2>&1; then
      $SUDO pacman -Sy --noconfirm $MISSING_TOOLS || fail "failed to install $MISSING_TOOLS via pacman — install manually and re-run."
    elif command -v apk >/dev/null 2>&1; then
      $SUDO apk add $MISSING_TOOLS || fail "failed to install $MISSING_TOOLS via apk — install manually and re-run."
    else
      fail "no supported package manager found (brew/apt/dnf/yum/pacman/apk) — install $MISSING_TOOLS manually and re-run."
    fi
    say "installed: $MISSING_TOOLS"
  fi

  if [ -n "$MISSING_PY_PKGS" ]; then
    python3 -m pip install --user pypdf \
      || fail "failed to install pypdf via pip — run 'python3 -m pip install --user pypdf' manually and re-run."
    say "installed: pypdf"
  fi
fi

command -v jq      >/dev/null 2>&1 || fail "jq is required and still missing — install it manually and re-run."
command -v python3 >/dev/null 2>&1 || fail "python3 is required and still missing — install it manually and re-run."

# --- 2. Live configs from examples -------------------------------------------
if [ -f "config/targets.json" ]; then
  say "config/targets.json exists — keeping it."
else
  cp "config/targets.example.json" "config/targets.json"
  say "created config/targets.json from the example — fill in the placeholders (or run 'applyr setup')."
fi

# --- 2b. Discord status updates (OPTIONAL, opt-in) -----------------------------
# Outcomes always land in the local state files and the TUI; Discord
# webhooks are an optional extra channel. Opting out writes a disabled
# config so the validator stays green; enable later via 'applyr setup'.
DISCORD_LIVE="config/discord_config.json"
write_disabled_discord() {
  printf '{\n  "enabled": false,\n  "webhooks": {}\n}\n' > "$DISCORD_LIVE"
}
if [ -f "$DISCORD_LIVE" ]; then
  say "$DISCORD_LIVE exists — keeping it."
elif [ -t 0 ]; then
  echo
  printf "Use Discord for status updates (applied / needs-review / failed / summary)? [y/N] "
  read -r DISCORD_OPT || DISCORD_OPT=""
  if [ "$DISCORD_OPT" = "y" ] || [ "$DISCORD_OPT" = "Y" ]; then
    echo
    echo "How should the updates be routed?"
    echo "  1) One channel for ALL status updates (one webhook link)"
    echo "  2) Separate channels per status (success / needs-review / failed / summary)"
    echo "${C_WARN}⚠  Separate channels: Discord binds each webhook to ONE channel, so${C_RESET}"
    echo "${C_WARN}   EACH channel needs its own webhook link (4 links for option 2).${C_RESET}"
    printf "Choose [1/2, default 1]: "
    read -r DISCORD_MODE || DISCORD_MODE=""
    ask_url() { # <label>
      local url
      printf "  %s webhook URL: " "$1" >&2
      read -r url || url=""
      printf '%s' "$url"
    }
    if [ "$DISCORD_MODE" = "2" ]; then
      U_SUCCESS="$(ask_url "success")"
      U_REVIEW="$(ask_url "needs-review")"
      U_FAILED="$(ask_url "failed")"
      U_SUMMARY="$(ask_url "summary (optional, enter to fall back to success)")"
    else
      U_ALL="$(ask_url "the one shared")"
      U_SUCCESS="$U_ALL"; U_REVIEW="$U_ALL"; U_FAILED="$U_ALL"; U_SUMMARY="$U_ALL"
    fi
    if [ -z "$U_SUCCESS" ]; then
      warn "no webhook URL entered — writing Discord as disabled; enable later with 'applyr setup'."
      write_disabled_discord
    else
      jq -n --arg s "$U_SUCCESS" --arg r "$U_REVIEW" --arg f "$U_FAILED" --arg m "$U_SUMMARY" \
        '{enabled: true, webhooks: ({success: $s, needs_review: $r, failed: $f} + (if $m == "" then {} else {summary: $m} end))}' \
        > "$DISCORD_LIVE"
      say "wrote $DISCORD_LIVE (Discord enabled)."
    fi
  else
    write_disabled_discord
    say "Discord skipped — outcomes stay local (state files + TUI). Enable any time with 'applyr setup'."
  fi
else
  write_disabled_discord
  say "non-interactive install — wrote $DISCORD_LIVE as disabled (enable via 'applyr setup')."
fi

# --- 3. Harness detection (Phase 15 + 16: all four major coding agents) -------
# Detected agents are offered in full-capability-first order; Codex and
# Copilot run the documented degraded path (no browser automation by
# default) — see the "Harness capability matrix" in AGENTS.md.
DETECTED=""
label_for() {
  case "$1" in
    opencode) echo "opencode" ;;
    claude)   echo "Claude Code" ;;
    codex)    echo "Codex CLI          (API boards only unless browser tooling is configured)" ;;
    copilot)  echo "GitHub Copilot CLI (API boards only unless browser tooling is configured)" ;;
  esac
}
for AGENT in opencode claude codex copilot; do
  command -v "$AGENT" >/dev/null 2>&1 && DETECTED="$DETECTED $AGENT"
done
DETECTED="${DETECTED# }"

if [ -z "$DETECTED" ]; then
  warn "no supported coding agent found (opencode, claude, codex, or copilot)."
  warn "install one, then re-run: https://opencode.ai · https://claude.com/claude-code"
  warn "  · https://developers.openai.com/codex/cli · https://docs.github.com/copilot"
fi

if [ -f "config/harness.json" ]; then
  say "config/harness.json exists — keeping it ($(jq -r '.harness // "?"' config/harness.json))."
else
  HARNESS=""
  set -- $DETECTED
  if [ "$#" -gt 1 ] && [ -t 0 ]; then
    # More than one agent installed and we can ask — let the user choose.
    echo
    echo "Which coding agent should applyr use for runs?"
    i=1
    for AGENT in $DETECTED; do
      echo "  $i) $(label_for "$AGENT")"
      i=$((i + 1))
    done
    printf "Choose [1-%s, default 1]: " "$#"
    read -r CHOICE || CHOICE=""
    case "$CHOICE" in
      *[!0-9]*|"") CHOICE=1 ;;
    esac
    [ "$CHOICE" -ge 1 ] && [ "$CHOICE" -le "$#" ] || CHOICE=1
    i=1
    for AGENT in $DETECTED; do
      [ "$i" -eq "$CHOICE" ] && HARNESS="$AGENT"
      i=$((i + 1))
    done
  elif [ "$#" -ge 1 ]; then
    HARNESS="$1"
  fi
  if [ -n "$HARNESS" ]; then
    printf '{\n  "harness": "%s"\n}\n' "$HARNESS" > config/harness.json
    say "wrote config/harness.json (harness: $HARNESS — change any time by editing the file or re-running this installer)."
  else
    say "skipped config/harness.json — no supported coding agent detected yet."
  fi
fi

# --- 4. User profile (safe_fields) ---------------------------------------
say "profile: run 'applyr' (or 'applyr setup') to fill in your name, contact info, and job targets through the guided wizard — or edit config/targets.json by hand (see the _help notes in config/targets.example.json)."

mkdir -p data/resumes
echo
echo "${C_NOTICE}📄  Resumes: add your base resumes (markdown + matching PDF) to${C_RESET}"
echo "${C_NOTICE}    $PROJECT_ROOT/data/resumes/${C_RESET}"
echo "${C_NOTICE}    See docs/SETUP.md for the expected filenames — applyr picks one per${C_RESET}"
echo "${C_NOTICE}    job by category and tailors it. This folder is gitignored — local only.${C_RESET}"
echo

# --- 5. Claude Code headless permissions (opt-in, asks first) ----------------
# Headless runs need pre-approved tools; this file grants Claude Code broad
# repo-local permissions, so it is only created with explicit consent.
if command -v claude >/dev/null 2>&1 && [ ! -f ".claude/settings.json" ]; then
  echo
  echo "Claude Code headless runs need pre-approved permissions in .claude/settings.json:"
  echo '  Bash(*), Edit(*), Write(*), Read(*), mcp__playwright__* (repo-local)'
  printf "Create it now? [y/N] "
  read -r REPLY || REPLY=""
  if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
    mkdir -p .claude
    cat > .claude/settings.json <<'JSON'
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Edit(*)",
      "Write(*)",
      "Read(*)",
      "mcp__playwright__*"
    ]
  },
  "enableAllProjectMcpServers": true
}
JSON
    say "wrote .claude/settings.json."
  else
    say "skipped .claude/settings.json — headless Claude runs will prompt for permissions."
  fi
fi

# --- 6. Agent definitions ------------------------------------------------------
python3 scripts/validate/generate_agent_definitions.py

# --- 7. Validate (also auto-seeds vetted Ashby/Lever slugs) --------------------
if bash scripts/validate/validate_local_config.sh; then
  say "config valid."
else
  warn "config not valid yet — edit the files named above (or run 'applyr setup'), then re-run:"
  warn "  bash scripts/validate/validate_local_config.sh"
fi

# --- 8. TUI / extension (optional) ---------------------------------------------
build_node_surface() {
  local dir="$1" label="$2"
  if [ ! -f "$dir/package.json" ]; then
    return 0
  fi
  if [ -d "$dir/node_modules" ] && [ -d "$dir/dist" ]; then
    say "$label already installed."
    return 0
  fi
  say "building $label ($dir/) …"
  (cd "$dir" && npm install --silent && npm run build --silent) \
    && say "$label ready." \
    || warn "$label build failed — see docs/SETUP.md."
}

if command -v npm >/dev/null 2>&1; then
  # packages/core has no install/prepare hook that builds it automatically —
  # app/'s and desktop/'s own `tsc` builds both need its dist/ already
  # present to resolve `@applyr/core/*` imports, which is never true on a
  # fresh clone. Build it first so both surfaces build clean below.
  npm run build:core --silent || warn "core build failed — the TUI build below will likely fail too. See docs/SETUP.md."
  build_node_surface app "the TUI"
  build_node_surface extension "the browser extension"
else
  say "node/npm not found — skipping the optional TUI and browser extension (docs/SETUP.md)."
fi

# --- 8b. Desktop app (optional, early preview) ----------------------------------
# Ships ALONGSIDE the TUI at this stage, not in place of it (that flips
# later). Building it needs Rust + OS-native GUI deps on top of Node — real
# prerequisites the TUI doesn't have — so this is opt-in and its own script
# (install_desktop.sh), and a failure here never fails this installer: the
# TUI install above already succeeded and stays fully usable either way.
if [ -f "desktop/package.json" ] && command -v npm >/dev/null 2>&1; then
  echo
  echo "applyr also has an early-preview desktop app (Tauri), alongside the TUI."
  echo "Building it needs a Rust toolchain and some OS build tools — this script"
  echo "offers to install anything missing, and first-time compiling can take"
  echo "several minutes."
  INSTALL_APP="n"
  if [ -t 0 ]; then
    printf "Install the desktop app too? [y/N] "
    read -r INSTALL_APP || INSTALL_APP="n"
  else
    say "non-interactive install — skipping the desktop app (opt-in only; run 'bash scripts/install/install_desktop.sh' any time to add it)."
  fi
  if [ "$INSTALL_APP" = "y" ] || [ "$INSTALL_APP" = "Y" ]; then
    bash "$PROJECT_ROOT/scripts/install/install_desktop.sh" \
      || warn "desktop app install failed (see above) — the TUI is unaffected. Fix the issue and retry any time with: bash scripts/install/install_desktop.sh"
  fi
fi

# --- 9. `applyr` command on PATH ------------------------------------------------
# One-command install ends with a working `applyr`: a tiny wrapper in
# ~/.local/bin (override with APPLYR_BIN) pins APPLYR_ROOT to this
# checkout. Never overwrites a foreign `applyr` binary.
if [ -f "app/dist/cli.js" ] && command -v node >/dev/null 2>&1; then
  BIN_DIR="${APPLYR_BIN:-$HOME/.local/bin}"
  WRAPPER="$BIN_DIR/applyr"
  if [ -e "$WRAPPER" ] && ! grep -q "applyr wrapper" "$WRAPPER" 2>/dev/null; then
    warn "$WRAPPER exists and is not applyr's wrapper — leaving it alone."
  else
    mkdir -p "$BIN_DIR"
    cat > "$WRAPPER" <<WRAP
#!/bin/sh
# applyr wrapper — generated by scripts/install/install.sh; safe to delete.
# Falls back to common install locations if this was moved or renamed
# after install, before giving up with an actionable error — rather
# than the raw Node MODULE_NOT_FOUND stack trace a stale hardcoded
# path would otherwise produce.
PIN="$PROJECT_ROOT"
ROOT=""
for c in "\$APPLYR_ROOT" "\$PIN" "\$APPLYR_HOME" "\$HOME/applyr" "\$HOME/ares"; do
  if [ -n "\$c" ] && [ -f "\$c/app/dist/cli.js" ]; then ROOT="\$c"; break; fi
done
if [ -z "\$ROOT" ]; then
  echo "applyr: install directory not found (last known: $PROJECT_ROOT)." >&2
  echo "applyr: if you moved it, set APPLYR_ROOT to the new location or re-run its installer." >&2
  exit 1
fi
APPLYR_ROOT="\${APPLYR_ROOT:-\$ROOT}" exec node "\$ROOT/app/dist/cli.js" "\$@"
WRAP
    chmod +x "$WRAPPER"
    say "installed the applyr command: $WRAPPER"
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *) warn "$BIN_DIR is not on your PATH — add it (e.g. export PATH=\"$BIN_DIR:\$PATH\" in your shell profile)." ;;
    esac
  fi
fi

say "done. Try: applyr   (updates auto-install on every run/launch; APPLYR_AUTO_UPDATE=0 disables, 'applyr update' runs one manually)."
