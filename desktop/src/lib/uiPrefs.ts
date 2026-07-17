import { useEffect, useState } from "react";

/**
 * Appearance preferences (theme + UI font), persisted in localStorage and
 * applied as data attributes on <html> that tokens.css keys off:
 * - theme: "system" leaves the attribute off (the prefers-color-scheme
 *   media query decides); "light"/"dark" set data-theme, which wins over
 *   the media query in both directions.
 * - font: "system" (default stack) or "geist" (bundled Geist/Geist Mono).
 * Purely a webview concern — nothing here touches the Python-owned state.
 */

export type ThemePref = "system" | "light" | "dark";
export type FontPref = "system" | "geist";

const THEME_KEY = "applyr.theme";
const FONT_KEY = "applyr.font";

export function loadThemePref(): ThemePref {
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function loadFontPref(): FontPref {
  return localStorage.getItem(FONT_KEY) === "geist" ? "geist" : "system";
}

export function applyUiPrefs(theme: ThemePref = loadThemePref(), font: FontPref = loadFontPref()): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset["theme"];
  else root.dataset["theme"] = theme;
  if (font === "system") delete root.dataset["font"];
  else root.dataset["font"] = font;
}

export function useUiPrefs(): {
  theme: ThemePref;
  font: FontPref;
  setTheme: (t: ThemePref) => void;
  setFont: (f: FontPref) => void;
} {
  const [theme, setThemeState] = useState<ThemePref>(loadThemePref);
  const [font, setFontState] = useState<FontPref>(loadFontPref);

  useEffect(() => {
    applyUiPrefs(theme, font);
  }, [theme, font]);

  return {
    theme,
    font,
    setTheme(t) {
      localStorage.setItem(THEME_KEY, t);
      setThemeState(t);
    },
    setFont(f) {
      localStorage.setItem(FONT_KEY, f);
      setFontState(f);
    },
  };
}
