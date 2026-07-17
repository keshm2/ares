import fs from "node:fs";
import path from "node:path";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Reads config/supabase.json — the live, gitignored Supabase project URL +
 * anon key (config/supabase.example.json is the committed placeholder
 * template, same convention as every other config/*.example.json file).
 * Returns undefined when the file is missing or still holds the example
 * placeholders, so callers (the desktop app's entry/auth screens) can show
 * a "hosted mode isn't configured yet" state instead of crashing.
 */
export function readSupabaseConfig(root: string): SupabaseConfig | undefined {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(root, "config", "supabase.json"), "utf8"),
    ) as Partial<SupabaseConfig>;
    const url = (parsed.url ?? "").trim();
    const anonKey = (parsed.anonKey ?? "").trim();
    if (!url || !anonKey) return undefined;
    if (url.includes("YOUR_PROJECT_REF") || anonKey === "YOUR_SUPABASE_ANON_KEY") return undefined;
    return { url, anonKey };
  } catch {
    return undefined;
  }
}
