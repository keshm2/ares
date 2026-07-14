import { spawnSync } from "node:child_process";

/**
 * Cross-platform interpreter resolution. The runtime helpers are Python
 * and (historically) bash; neither `python3` nor `bash` exists by that
 * literal name on native Windows. This module resolves the real command
 * once per process so the TUI runs on PowerShell / cmd.exe without WSL.
 */

const isWindows = process.platform === "win32";

let cachedPython: { cmd: string; prefix: string[] } | undefined;

/**
 * Resolve a working Python 3. On Windows the py-launcher (`py -3`) is
 * preferred, then `python`; elsewhere `python3` then `python`. Falls back
 * to the first candidate (which then fails loudly) if none respond.
 */
export function pythonCmd(): { cmd: string; prefix: string[] } {
  if (cachedPython) return cachedPython;
  const candidates: { cmd: string; prefix: string[] }[] = isWindows
    ? [
        { cmd: "py", prefix: ["-3"] },
        { cmd: "python", prefix: [] },
        { cmd: "python3", prefix: [] },
      ]
    : [
        { cmd: "python3", prefix: [] },
        { cmd: "python", prefix: [] },
      ];
  for (const c of candidates) {
    try {
      const r = spawnSync(c.cmd, [...c.prefix, "--version"], { stdio: "ignore" });
      if (r.status === 0) {
        cachedPython = c;
        return c;
      }
    } catch {
      /* try next candidate */
    }
  }
  cachedPython = candidates[0];
  return cachedPython;
}

/**
 * Build a spawn-ready { cmd, args } that runs the given Python arguments
 * under the resolved interpreter. Use everywhere instead of a literal
 * "python3" spawn target.
 */
export function py(args: string[]): { cmd: string; args: string[] } {
  const p = pythonCmd();
  return { cmd: p.cmd, args: [...p.prefix, ...args] };
}
