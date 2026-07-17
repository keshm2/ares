#!/usr/bin/env python3
"""uninstall.py — cross-platform uninstaller.

Ported from uninstall.sh so it runs natively on Windows as well as
macOS/Linux. uninstall.sh remains a thin Unix shim.

  uninstall.py            # interactive (asks before deleting the dir)
  uninstall.py --yes      # no prompts (still prints what it did)
  uninstall.py --keep-data  # remove schedule + command, keep the install dir

Removes, in order:
  1. The schedule (scheduler.py uninstall — launchd/schtasks).
  2. The `applyr` command on PATH — only applyr's own wrapper/shim pointing
     at THIS install.
  2b. The desktop app (early preview), if it was installed alongside the
      TUI via scripts/install/install_desktop.sh|ps1 — best-effort, never
      fails the uninstall.
  3. The install directory (live config, data/ incl. resumes, logs/ — PII),
     only after an explicit confirmation (or --yes).

npm installs: `npm uninstall -g @keshm/applyr` removes the TUI command (a
reminder is printed when one is detected). The npm package never owns the
core directory — this script does.
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
IS_WINDOWS = os.name == "nt"


def say(msg: str) -> None:
    print(f"uninstall: {msg}")


def _remove_readonly(func, path, _exc):
    # Windows: clear the read-only bit and retry (git objects are read-only).
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except OSError:
        pass


def _remove_unix_wrapper() -> None:
    bin_dir = os.environ.get("APPLYR_BIN", os.path.join(os.path.expanduser("~"), ".local", "bin"))
    wrapper = os.path.join(bin_dir, "applyr")
    if not os.path.isfile(wrapper):
        return
    try:
        with open(wrapper, "r", encoding="utf-8", errors="ignore") as fh:
            body = fh.read()
    except OSError:
        return
    if "applyr wrapper" not in body:
        return
    if ROOT in body:
        try:
            os.remove(wrapper)
            say(f"removed the applyr command ({wrapper}).")
        except OSError:
            pass
    else:
        say(f"{wrapper} points at a different install — left alone.")


def _remove_windows_wrapper() -> None:
    bin_dir = os.environ.get("APPLYR_BIN", os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "applyr", "bin"))
    for name in ("applyr.cmd", "applyr.ps1"):
        shim = os.path.join(bin_dir, name)
        if not os.path.isfile(shim):
            continue
        try:
            with open(shim, "r", encoding="utf-8", errors="ignore") as fh:
                body = fh.read()
        except OSError:
            continue
        if "applyr wrapper" not in body:
            continue
        if ROOT in body:
            try:
                os.remove(shim)
                say(f"removed the applyr command ({shim}).")
            except OSError:
                pass
        else:
            say(f"{shim} points at a different install — left alone.")


def _remove_desktop_app() -> None:
    """Best-effort removal of the early-preview desktop app (Tauri), installed
    by scripts/install/install_desktop.sh|ps1 alongside the TUI. Every branch
    is best-effort and silent on failure — a leftover desktop app is a minor
    annoyance, not worth failing the whole uninstall over."""
    if sys.platform == "darwin":
        for base in ("/Applications", os.path.join(os.path.expanduser("~"), "Applications")):
            app = os.path.join(base, "applyr.app")
            if os.path.isdir(app):
                subprocess.run(["osascript", "-e", 'quit app "applyr"'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try:
                    shutil.rmtree(app)
                    say(f"removed the desktop app ({app}).")
                except OSError:
                    say(f"couldn't remove the desktop app ({app}) — delete it manually.")
    elif IS_WINDOWS:
        # Tauri's NSIS template (the installer scripts/install/install_desktop.ps1
        # prefers) registers a per-user uninstaller here; run it silently if found.
        # No registry access without pywin32, so this shells out to reg.exe's
        # query output rather than importing winreg's ambiguous 32/64-bit views.
        try:
            key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\applyr"
            result = subprocess.run(["reg", "query", key, "/v", "UninstallString"],
                                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
            if result.returncode == 0:
                for line in result.stdout.splitlines():
                    if "UninstallString" in line:
                        uninstall_cmd = line.split("REG_SZ", 1)[-1].strip()
                        if uninstall_cmd:
                            subprocess.run(f'{uninstall_cmd} /S', shell=True,
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            say("removed the desktop app.")
                        break
        except OSError:
            pass
    else:
        # Linux: whichever install path install_desktop.sh took.
        home = os.path.expanduser("~")
        appdir = os.path.join(home, ".local", "share", "applyr")
        desktop_entry = os.path.join(home, ".local", "share", "applications", "applyr.desktop")
        symlink = os.path.join(home, ".local", "bin", "applyr-app")
        removed_any = False
        for path in (appdir, desktop_entry, symlink):
            if os.path.exists(path) or os.path.islink(path):
                try:
                    if os.path.isdir(path) and not os.path.islink(path):
                        shutil.rmtree(path)
                    else:
                        os.remove(path)
                    removed_any = True
                except OSError:
                    pass
        if removed_any:
            say("removed the AppImage-installed desktop app.")
        # Package-manager installs (.deb/.rpm) — best-effort, needs sudo, so
        # just ask rather than silently invoking a privileged command.
        for pkg_mgr, query, remove in (
            ("dpkg", ["dpkg", "-s", "applyr"], ["apt-get", "remove", "-y", "applyr"]),
            ("rpm", ["rpm", "-q", "applyr"], ["dnf", "remove", "-y", "applyr"]),
        ):
            if shutil.which(pkg_mgr) and subprocess.run(
                query, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            ).returncode == 0:
                say(f"the desktop app is also installed as a system package — remove it with:")
                say(f"  sudo {' '.join(remove)}")


def main(argv) -> int:
    yes = keep_data = False
    for arg in argv:
        if arg in ("--yes", "-y"):
            yes = True
        elif arg == "--keep-data":
            keep_data = True
        else:
            sys.stderr.write(f"uninstall: unknown option: {arg}\n")
            return 1

    os.chdir(ROOT)

    # 1. Schedule.
    scheduler = os.path.join("scripts", "runtime", "scheduler.py")
    if os.path.isfile(scheduler):
        rc = subprocess.run([sys.executable, scheduler, "uninstall"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
        say("removed the schedule." if rc == 0 else "no schedule installed — skipped.")

    # 2. PATH wrapper — only applyr's own, pointing here.
    if IS_WINDOWS:
        _remove_windows_wrapper()
    else:
        _remove_unix_wrapper()

    # 2b. The desktop app (early preview, opt-in install — see
    # scripts/install/install_desktop.sh|ps1), if present.
    _remove_desktop_app()

    # npm-installed TUI reminder.
    npm = shutil.which("npm")
    if npm:
        detected = subprocess.run([npm, "ls", "-g", "@keshm/applyr"],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if detected:
            say("npm package detected — also run: npm uninstall -g @keshm/applyr")

    # 3. The install directory (PII).
    if keep_data:
        say(f"kept the install directory ({ROOT}) — delete it later manually.")
        say("done.")
        return 0

    if not yes:
        if sys.stdin.isatty():
            print()
            print("About to permanently delete the install directory and EVERYTHING in it:")
            print(f"  {ROOT}")
            print("This includes your live config, application history and resumes (data/), and logs.")
            try:
                reply = input("Delete it? [y/N] ").strip()
            except EOFError:
                reply = ""
            if reply not in ("y", "Y"):
                say(f"kept the install directory ({ROOT}). Re-run with --yes when ready.")
                say("done.")
                return 0
        else:
            say(f"non-interactive and no --yes: keeping the install directory ({ROOT}).")
            say("done.")
            return 0

    os.chdir(os.path.abspath(os.sep))
    shutil.rmtree(ROOT, onerror=_remove_readonly)
    print(f"uninstall: removed {ROOT}. applyr is uninstalled.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
