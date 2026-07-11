import "server-only";
import { createClient } from "./server";

/**
 * The currently signed-in user, or null when anonymous. Uses the cookie session via the
 * SSR client. Accounts are OPTIONAL (anonymous-first) — callers must handle null gracefully
 * and fall back to the anon_id cookie for ownership.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}
