<#
install_desktop.ps1 - builds and installs the applyr desktop app (Tauri +
React) from source, natively on Windows (PowerShell, no WSL).

Separate from install.ps1 (which calls into this as an opt-in step) so it
can also be re-run standalone after fixing a missing dependency:

  powershell -ExecutionPolicy Bypass -File scripts\install\install_desktop.ps1

Early-preview status: the desktop app ships ALONGSIDE the TUI, not in
place of it - this script never touches the TUI install, and install.ps1
treats a non-zero exit from this script as a warning, not a hard failure.

Unlike the TUI (plain Node/npm), building the desktop app needs a Rust
toolchain (MSVC target) and the Visual C++ Build Tools that toolchain
links against - real, sometimes multi-minute prerequisites. This script
checks for each and offers to install what's missing before building.
#>

$ErrorActionPreference = "Stop"

function Say  { param($m) Write-Host "install-desktop: $m" }
function Warn { param($m) Write-Host "install-desktop: WARNING: $m" -ForegroundColor Yellow }
function Fail { param($m) Write-Host "install-desktop: ERROR: $m" -ForegroundColor Red; exit 1 }

$scriptDir = Split-Path -Parent $PSCommandPath
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
Set-Location $projectRoot

if (-not (Test-Path "desktop\package.json")) { Fail "desktop\ not found in this checkout - nothing to build." }

# --- 1. Rust toolchain --------------------------------------------------------
function Refresh-Path {
  $machine = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
  $user = [System.Environment]::GetEnvironmentVariable("PATH", "User")
  $env:PATH = "$machine;$user"
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Warn "not detected: Rust (cargo) - required to compile the desktop app's native shell."
  $installRust = "y"
  try {
    $installRust = Read-Host "Install Rust now via rustup (official installer, ~minimal profile)? [Y/n]"
  } catch { }
  if (-not $installRust) { $installRust = "y" }
  if ($installRust -notmatch '^[Yy]') {
    Fail "cannot build the desktop app without Rust. Install it yourself (https://rustup.rs) and re-run."
  }
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Say "installing Rust via winget (rustup)..."
    try {
      winget install --id Rustlang.Rustup -e --silent --accept-package-agreements --accept-source-agreements
    } catch {
      Fail "rustup install via winget failed - install manually from https://rustup.rs and re-run."
    }
    Refresh-Path
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
      # The winget package installs rustup-init but doesn't always finish
      # toolchain setup non-interactively - finish it explicitly.
      $rustupInit = Get-Command rustup-init -ErrorAction SilentlyContinue
      if ($rustupInit) {
        try {
          & $rustupInit.Source -y --default-toolchain stable --profile minimal
        } catch { }
        Refresh-Path
      }
    }
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
      Fail "Rust installed but cargo still not on PATH - open a NEW terminal and re-run this script."
    }
    Say "installed Rust ($(cargo --version))."
  } else {
    Fail "winget isn't available to install Rust automatically. Install from https://rustup.rs and re-run."
  }
}

# --- 2. Visual C++ Build Tools (Rust's MSVC linker needs these) ---------------
# No lightweight, reliable way to detect an existing VS/Build Tools install
# from a plain script - probe for the linker instead. If it's missing,
# offer the winget silent-install path (a real, documented winget pattern
# for CI-style Build Tools installs); if that fails or winget is
# unavailable, degrade to clear manual instructions rather than blocking.
$hasLinker = $false
try {
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    $vsInstall = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsInstall) { $hasLinker = $true }
  }
} catch { }

if (-not $hasLinker) {
  Warn "Visual C++ Build Tools not detected - required to link the Windows app (Rust's MSVC target needs link.exe)."
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $installVc = Read-Host "Install Build Tools now via winget (~2-4GB download, several minutes)? [Y/n]"
    if (-not $installVc) { $installVc = "y" }
    if ($installVc -match '^[Yy]') {
      Say "installing Visual C++ Build Tools via winget - this can take a while..."
      try {
        $vcOverride = "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
        winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --override $vcOverride
        Say "Build Tools installed."
      } catch {
        Warn "automatic Build Tools install failed. Install manually: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Warn "(select the 'Desktop development with C++' workload), then re-run this script."
      }
    } else {
      Warn "skipping - the build below will fail at the link step until Build Tools are installed."
    }
  } else {
    Warn "winget isn't available. Install Build Tools manually: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    Warn "(select the 'Desktop development with C++' workload), then re-run this script."
  }
}

# --- 3. Build ------------------------------------------------------------------
# Every native-command call below is wrapped in try/catch, not just a
# $LASTEXITCODE check: on PowerShell 7.3+ with
# $PSNativeCommandUseErrorActionPreference on (increasingly the default), a
# non-zero exit under $ErrorActionPreference = "Stop" throws instead of
# just setting $LASTEXITCODE — same gotcha install.ps1 already works
# around for its Python check. Uncaught, that would abort with a raw
# exception instead of this script's own clean Fail message.

# packages/core has no install/prepare hook that builds it automatically -
# both the TUI and the desktop app need its dist/ built explicitly first.
Say "building the shared core..."
$coreOk = $true
try {
  npm run build:core --silent
  if ($LASTEXITCODE -ne 0) { $coreOk = $false }
} catch { $coreOk = $false }
if (-not $coreOk) { Fail "core build failed." }

Say "building the desktop frontend..."
$feOk = $true
Push-Location desktop
try {
  npm install --silent
  if ($LASTEXITCODE -eq 0) { npm run build --silent }
  if ($LASTEXITCODE -ne 0) { $feOk = $false }
} catch {
  $feOk = $false
} finally {
  Pop-Location
}
if (-not $feOk) { Fail "desktop frontend build failed." }

Say "compiling the desktop app (first run downloads + compiles Tauri's Rust dependencies - this can take several minutes)..."
$buildOk = $true
Push-Location desktop
try {
  npx tauri build
  if ($LASTEXITCODE -ne 0) { $buildOk = $false }
} catch {
  $buildOk = $false
} finally {
  Pop-Location
}
if (-not $buildOk) {
  Fail "desktop app build failed - see the error above. If it's a link error, the Visual C++ Build Tools step above needs to complete first; open a NEW terminal after installing them and re-run."
}

# --- 4. Install the built bundle ------------------------------------------------
$bundleDir = "desktop\src-tauri\target\release\bundle"

# NSIS installs per-user under %LOCALAPPDATA% with no elevation prompt by
# default in Tauri's template - prefer it over the MSI (which typically
# needs an admin prompt for a Program Files install) so this matches the
# no-elevation-needed install the app already gets on macOS.
$nsis = Get-ChildItem -Path (Join-Path $bundleDir "nsis") -Filter "*-setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$msi  = Get-ChildItem -Path (Join-Path $bundleDir "msi") -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($nsis) {
  Say "installing $($nsis.Name) (silent)..."
  $p = Start-Process -FilePath $nsis.FullName -ArgumentList "/S" -Wait -PassThru
  if ($p.ExitCode -eq 0) {
    Say "installed. Find 'applyr' in the Start Menu, or run: $($nsis.FullName) (double-click to install manually if the silent flag didn't take)."
  } else {
    Warn "silent install returned exit code $($p.ExitCode) - run the installer manually: $($nsis.FullName)"
  }
} elseif ($msi) {
  Say "installing $($msi.Name) (silent, may prompt for admin)..."
  $p = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$($msi.FullName)`"", "/quiet", "/norestart" -Wait -PassThru
  if ($p.ExitCode -eq 0) {
    Say "installed. Find 'applyr' in the Start Menu."
  } else {
    Warn "silent install returned exit code $($p.ExitCode) - run the installer manually: $($msi.FullName)"
  }
} else {
  Fail "no installable bundle found under $bundleDir - build may have failed silently."
}

Say "done."
