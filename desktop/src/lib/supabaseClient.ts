import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findRoot, readSupabaseConfig } from "./bridge";

let cachedClient: SupabaseClient | undefined;

/**
 * Lazily creates the Supabase client from config/supabase.json (read via
 * the Rust bridge, never bundled/hardcoded — same live-config discipline as
 * every other config/*.json file in this repo). Returns undefined when
 * hosted mode isn't configured on this machine yet, so callers can render
 * a "sign in isn't set up yet" state instead of throwing. Only a
 * successfully created client is cached — a missing config is re-checked
 * on the next call, so dropping in config/supabase.json doesn't require an
 * app restart. Bridge failures (e.g. node not spawnable) reject; callers
 * must catch and surface them rather than hanging on a pending state.
 */
export async function getSupabaseClient(): Promise<SupabaseClient | undefined> {
  if (cachedClient) return cachedClient;
  const root = await findRoot();
  const config = await readSupabaseConfig(root);
  if (!config) return undefined;
  cachedClient = createClient(config.url, config.anonKey, {
    // flowType "pkce" is required: AuthContext finishes both the
    // email-confirmation and Google OAuth callbacks with
    // exchangeCodeForSession(), which only exists in the PKCE flow — the
    // default implicit flow puts tokens in a URL fragment instead of
    // issuing a ?code=, so the applyr:// deep-link callback could never
    // complete a session under it.
    auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce" },
  });
  return cachedClient;
}
