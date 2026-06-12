import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Secret-key client for server-side writes/reads that must bypass RLS (anonymous-author
// warrens). Uses the new Supabase secret key (sb_secret_…). NEVER import this into client
// code. Returns null when unconfigured so callers degrade gracefully (placeholder keys).
let admin: SupabaseClient | null | undefined;

const isPlaceholder = (v?: string) =>
  !v || v.includes("placeholder") || v.includes("your-");

export function getAdminClient(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (isPlaceholder(url) || isPlaceholder(key)) {
    admin = null;
    return null;
  }
  admin = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** True when a real Supabase project is wired up (not placeholders). */
export function isSupabaseConfigured(): boolean {
  return getAdminClient() !== null;
}
