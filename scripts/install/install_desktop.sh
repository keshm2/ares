#!/bin/bash
# install_desktop.sh — builds and installs the applyr desktop app (Tauri +
# React) from source, for macOS and Linux.
#
# This is a separate script from install.sh (which calls into this one as
# an opt-in step) so it can also be re-run standalone after fixing a
# missing dependency:
#
#   bash scripts/install/install_desktop.sh
#
# Early-preview status: the desktop app ships ALONGSIDE the TUI, not in
# place of it — this script never touches the TUI install and a failure
# here is never allowed to take down install.sh's main flow (see the
# caller in install.sh, which treats a non-zero exit as a warning, not a
# hard failure).
#
# Unlike the TUI (plain Node/npm), building the desktop app needs a Rust
# toolchain and OS-native GUI build dependencies (Tauri wraps the system
# webview). Those are real, sometimes multi-minute-to-install
# prerequisites — this script checks for each, offers to install what's
# missing (same "detect everything first, ask once" pattern as
# install.sh's own step 1), and always leaves the TUI usable even if a
# step here fails.

set -euo pipefail

say()  { echo "install-desktop: $*"; }
warn() { echo "install-desktop: WARNING: $*" >&2; }
fail() { echo "install-desktop: ERROR: $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

[ -f "desktop/package.json" ] || fail "desktop/ not found in this checkout — nothing to build."

OS="$(uname -s)"
SUDO=""
[ "$(id -u 2>/dev/null || echo 0)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"

# --- 1. Rust toolchain --------------------------------------------------------
if ! command -v cargo >/dev/null 2>&1; then
  warn "not detected: Rust (cargo) — required to compile the desktop app's native shell."
  INSTALL_RUST="y"
  if [ -t 0 ]; then
    printf "Install Rust now via rustup (official installer, ~minimal profile)? [Y/n] "
    read -r INSTALL_RUST || INSTALL_RUST="y"
    [ -z "$INSTALL_RUST" ] && INSTALL_RUST="y"
  else
    warn "non-interactive — installing Rust automatically (re-run interactively to be asked first)."
  fi
  case "$INSTALL_RUST" in
    y|Y) ;;
    *) fail "cannot build the desktop app without Rust. Install it yourself (https://rustup.rs) and re-run." ;;
  esac
  # --profile minimal: rustc + cargo + the stdlib only, skips rustfmt/
  # clippy/docs — this script only ever compiles, never lints/formats.
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --profile minimal \
    || fail "rustup install failed — install Rust yourself (https://rustup.rs) and re-run."
  # shellcheck disable=SC1091
  . "$HOME/.cargo/env"
  command -v cargo >/dev/null 2>&1 || fail "Rust installed but cargo still not on PATH — open a new shell and re-run."
  say "installed Rust ($(rustc --version))."
fi

# --- 2. OS-native build dependencies ------------------------------------------
if [ "$OS" = "Darwin" ]; then
  if ! xcode-select -p >/dev/null 2>&1; then
    warn "Xcode Command Line Tools not found — required to link the macOS app."
    INSTALL_CLT="y"
    if [ -t 0 ]; then
      printf "Install them now (opens Apple's installer — a few minutes)? [Y/n] "
      read -r INSTALL_CLT || INSTALL_CLT="y"
      [ -z "$INSTALL_CLT" ] && INSTALL_CLT="y"
    else
      warn "non-interactive — triggering the install automatically (re-run interactively to be asked first)."
    fi
    case "$INSTALL_CLT" in
      y|Y) ;;
      *) fail "cannot build the desktop app without Xcode Command Line Tools. Install them yourself (xcode-select --install) and re-run." ;;
    esac
    # Unlike every other dependency in this script, this one can't be
    # waited on: xcode-select --install hands off to an async native GUI
    # installer with no CLI completion signal to poll. Trigger it and stop
    # here — the next run picks up cleanly once it's done.
    xcode-select --install >/dev/null 2>&1 || true
    fail "a Command Line Tools installer window should have opened — finish that, then re-run: bash scripts/install/install_desktop.sh"
  fi
elif [ "$OS" = "Linux" ]; then
  # Tauri wraps the system webview (webkit2gtk) rather than bundling one —
  # these are the documented Tauri v2 Linux build deps, one line per
  # package manager (same detection order as install.sh's step 1).
  if command -v apt-get >/dev/null 2>&1; then
    PKGS="libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev"
    PKG_CHECK="dpkg -s libwebkit2gtk-4.1-dev"
    PKG_INSTALL="$SUDO apt-get update && $SUDO apt-get install -y $PKGS"
  elif command -v dnf >/dev/null 2>&1; then
    PKGS="webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++ make"
    PKG_CHECK="rpm -q webkit2gtk4.1-devel"
    PKG_INSTALL="$SUDO dnf install -y $PKGS"
  elif command -v pacman >/dev/null 2>&1; then
    PKGS="webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg"
    PKG_CHECK="pacman -Qi webkit2gtk-4.1"
    PKG_INSTALL="$SUDO pacman -Sy --noconfirm $PKGS"
  else
    warn "no supported package manager found (apt/dnf/pacman) — install Tauri's Linux dependencies yourself:"
    warn "  https://v2.tauri.app/start/prerequisites/#linux"
    PKG_CHECK=""
    PKG_INSTALL=""
  fi
  if [ -n "$PKG_CHECK" ] && ! eval "$PKG_CHECK" >/dev/null 2>&1; then
    warn "desktop build dependencies not detected ($PKGS)."
    INSTALL_DEPS="y"
    if [ -t 0 ]; then
      printf "Install them now (needs sudo)? [Y/n] "
      read -r INSTALL_DEPS || INSTALL_DEPS="y"
      [ -z "$INSTALL_DEPS" ] && INSTALL_DEPS="y"
    else
      warn "non-interactive — installing them automatically (re-run interactively to be asked first)."
    fi
    case "$INSTALL_DEPS" in
      y|Y) eval "$PKG_INSTALL" || fail "dependency install failed — install manually (https://v2.tauri.app/start/prerequisites/#linux) and re-run." ;;
      *) fail "cannot build the desktop app without these — install manually and re-run." ;;
    esac
    say "installed desktop build dependencies."
  fi
else
  fail "unsupported OS for this script ($OS) — Windows uses scripts/install/install_desktop.ps1."
fi

# --- 3. Build ------------------------------------------------------------------
# packages/core has no install/prepare hook that builds it automatically —
# both the TUI and the desktop app need its dist/ built explicitly first.
say "building the shared core…"
npm run build:core --silent || fail "core build failed."

say "building the desktop frontend…"
(cd desktop && npm install --silent && npm run build --silent) \
  || fail "desktop frontend build failed."

say "compiling the desktop app (first run downloads + compiles Tauri's Rust dependencies — this can take several minutes)…"
(cd desktop && npx tauri build) \
  || fail "desktop app build failed — see the error above. Common causes: missing native deps (previous step), or a stale Cargo cache (try: rm -rf desktop/src-tauri/target && re-run)."

BUNDLE_DIR="desktop/src-tauri/target/release/bundle"

# --- 4. Install the built bundle ------------------------------------------------
if [ "$OS" = "Darwin" ]; then
  APP_SRC="$BUNDLE_DIR/macos/applyr.app"
  [ -d "$APP_SRC" ] || fail "expected bundle not found at $APP_SRC — build may have failed silently."

  DEST="/Applications"
  [ -w "$DEST" ] || DEST="$HOME/Applications"
  mkdir -p "$DEST"

  osascript -e 'quit app "applyr"' >/dev/null 2>&1 || true
  rm -rf "$DEST/applyr.app"
  cp -R "$APP_SRC" "$DEST/applyr.app"
  say "installed: $DEST/applyr.app"
  say "open it from Finder/Launchpad, or: open '$DEST/applyr.app'"

elif [ "$OS" = "Linux" ]; then
  DEB="$(find "$BUNDLE_DIR/deb" -maxdepth 1 -name '*.deb' 2>/dev/null | head -n1 || true)"
  RPM="$(find "$BUNDLE_DIR/rpm" -maxdepth 1 -name '*.rpm' 2>/dev/null | head -n1 || true)"
  APPIMAGE="$(find "$BUNDLE_DIR/appimage" -maxdepth 1 -name '*.AppImage' 2>/dev/null | head -n1 || true)"

  if [ -n "$DEB" ] && command -v apt-get >/dev/null 2>&1; then
    # apt (not dpkg -i) so it resolves the bundle's runtime deps too.
    $SUDO apt-get install -y "./$DEB" || fail "apt install of $DEB failed."
    say "installed via apt: $DEB"
  elif [ -n "$RPM" ] && command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y "./$RPM" || fail "dnf install of $RPM failed."
    say "installed via dnf: $RPM"
  elif [ -n "$APPIMAGE" ]; then
    APPDIR="$HOME/.local/share/applyr"
    mkdir -p "$APPDIR" "$HOME/.local/share/applications" "$HOME/.local/bin"
    cp "$APPIMAGE" "$APPDIR/applyr.AppImage"
    chmod +x "$APPDIR/applyr.AppImage"
    ln -sf "$APPDIR/applyr.AppImage" "$HOME/.local/bin/applyr-app"
    ICON_SRC="desktop/src-tauri/icons/128x128.png"
    [ -f "$ICON_SRC" ] && cp "$ICON_SRC" "$APPDIR/icon.png"
    cat > "$HOME/.local/share/applications/applyr.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=applyr
Comment=applyr desktop app
Exec=$APPDIR/applyr.AppImage
Icon=$APPDIR/icon.png
Categories=Office;
Terminal=false
DESKTOP
    command -v update-desktop-database >/dev/null 2>&1 \
      && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
    say "installed: $APPDIR/applyr.AppImage (find \"applyr\" in your application launcher, or run: applyr-app)"
  else
    fail "no installable bundle found under $BUNDLE_DIR — build may have failed silently."
  fi
fi

say "done."
