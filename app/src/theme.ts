/**
 * Color roles — defined once, referenced everywhere. The terminal's own
 * foreground/background is the ground; outcome colors (good/warn/danger)
 * are reserved for outcomes and never used decoratively. Ink/chalk
 * degrades hex to 256/16 colors and honors NO_COLOR automatically;
 * meaning never rides on color alone — the glyph map below pairs a
 * symbol with every semantic color so the 16-color / NO_COLOR runs stay
 * legible.
 */
export const theme = {
  accent: "#8B5CF6", // violet — active tab, selection, titles
  rule: "#6D28D9", // dim violet — header/footer rules only
  good: "green",
  warn: "yellow",
  danger: "red",
} as const;

export const statusColor: Record<string, string> = {
  applied: theme.good,
  needs_review: theme.warn,
  failed: theme.danger,
};

/** Status glyphs — paired with statusColor so meaning survives NO_COLOR. */
export const statusGlyph: Record<string, string> = {
  applied: "✓",
  needs_review: "◐",
  failed: "✗",
};

/** Selection marker — the one place boldness is spent on focus. */
export const SELECT_MARKER = "▸";

/** Hot red for the heavy+ tier — deliberately louder than the plain
 *  `red` outcome color so 22+ caps read as a warning, not a failure. */
export const HEAVY_PLUS_RED = "#FF3B30";

/** Session-cap tiers — the cap picker colors by cost so the difference
 *  between a 3-job test and a 25-job MAX run is visible at a glance.
 *  25 = MAX (the gauge renders rainbow), 22+ = heavy+ (hot red),
 *  17+ = heavy (yellow). */
export interface CapTier {
  name: string;
  color: string;
}
export function capTier(cap: number): CapTier {
  if (cap >= 25) return { name: "MAX", color: theme.danger };
  if (cap >= 22) return { name: "heavy+", color: HEAVY_PLUS_RED };
  if (cap >= 17) return { name: "heavy", color: theme.warn };
  if (cap >= 6) return { name: "standard", color: theme.accent };
  return { name: "light", color: theme.good };
}

/** hsl(hue, 100%, 65%) → #rrggbb — drives the animated MAX-cap warning. */
export function hueColor(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  const c = 0.7; // chroma at 100% saturation, 65% lightness
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 0.65 - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** #rrggbb → [r, g, b] (0-255 each) — helper for gradientColor's lerp. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** phase (any real number) → #rrggbb, smoothly interpolated within the
 *  given gradient (default BANNER_GRADIENT). Bounces back and forth
 *  across the stops (a triangle wave) instead of wrapping the last stop
 *  straight back to the first — a straight wrap would lerp maroon
 *  (#800020, near-zero green/blue) directly to violet (#A78BFA, high
 *  blue), passing through muddy green/blue-tinted hues on the way.
 *  Ping-ponging means every step is a lerp between two *adjacent*,
 *  intentionally-designed stops, so it can never produce an off-palette
 *  hue — the gradient analog of hueColor's hue wheel, used to drive the
 *  animated AUTO-mode sparkle. */
export function gradientColor(phase: number, stops: readonly string[] = BANNER_GRADIENT): string {
  const n = stops.length;
  if (n === 1) return stops[0]!;
  const period = 2 * (n - 1);
  const x = (((phase % period) + period) % period); // wrap into [0, period)
  const t = x <= n - 1 ? x : period - x; // reflect the second half back — the ping-pong
  const i = Math.min(n - 2, Math.floor(t));
  const frac = t - i;
  const [r1, g1, b1] = hexToRgb(stops[i]!);
  const [r2, g2, b2] = hexToRgb(stops[i + 1]!);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * frac);
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hex(lerp(r1, r2))}${hex(lerp(g1, g2))}${hex(lerp(b1, b2))}`;
}

/** ASCII banner — the one loud element. Rows fade violet → maroon. */
export const BANNER_ROWS = [
  " █████╗ ██████╗ ██████╗ ██╗     ██╗   ██╗██████╗ ",
  "██╔══██╗██╔══██╗██╔══██╗██║     ╚██╗ ██╔╝██╔══██╗",
  "███████║██████╔╝██████╔╝██║      ╚████╔╝ ██████╔╝",
  "██╔══██║██╔═══╝ ██╔═══╝ ██║       ╚██╔╝  ██╔══██╗",
  "██║  ██║██║     ██║     ███████╗   ██║   ██║  ██║",
  "╚═╝  ╚═╝╚═╝     ╚═╝     ╚══════╝   ╚═╝   ╚═╝  ╚═╝",
] as const;

export const BANNER_GRADIENT = [
  "#A78BFA", // violet
  "#9265F0",
  "#7C3AED",
  "#7E22CE", // purple
  "#8B1E5B", // plum
  "#800020", // maroon
] as const;

/** Purple → white — the same two-color blend UpdateBox's traveling
 *  border ring uses (see blend() there), reused here so every "AUTO"
 *  sparkle (AutoSparkleText, GradientProgressBar) reads as one visual
 *  language across the app. gradientColor's ping-pong bounces cleanly
 *  between the two, so this never touches the banner's plum/maroon end
 *  (which read as "too much red" when it was in the sparkle mix). The
 *  static banner keeps its own full BANNER_GRADIENT — this is scoped to
 *  animations only. */
export const SPARKLE_GRADIENT = [theme.accent, "#FFFFFF"] as const;

/** Cycling "working" glyph — the terminal-spinner analog of a color
 *  animation, small dot growing to a starburst and back (". to *" and
 *  a bit beyond), used anywhere text needs to signal live activity. */
export const SPINNER_FRAMES = [".", "·", "•", "*", "•", "·"] as const;

export const BANNER_WIDTH = BANNER_ROWS[0].length;

/** Below this size the app shows a "terminal too small" notice. The tab
 *  row is the binding constraint: five tabs plus the Review "(n)" badge need
 *  ~53 cols, and wrapping it corrupts the pinned frame. The banner
 *  collapses earlier. */
export const MIN_COLUMNS = 54;
export const MIN_ROWS = 12;

/** Build/release marker shown in the side panel footer. */
export const BUILD_MARKER = "0.8.43a";

/** Side panel width — narrow enough to coexist with content on 64-col+
 *  terminals. The panel hides below that width (see App showSidebar). */
export const SIDE_PANEL_WIDTH = 20;
