import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { claimAnonWarrens } from "@/lib/explore/repository";

const ANON_COOKIE = "warren_anon";

/**
 * Sanitize the post-login `next` target to an on-site, path-relative URL. `next` is
 * attacker-controllable (a query param on a crafted login link), so passing it unchecked to
 * a redirect is an open-redirect (post-auth phishing). Accept only a path that starts with a
 * single "/" — reject absolute URLs, protocol-relative "//host", and backslash tricks "/\".
 */
function safeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

// GET /auth/callback?code=... — Supabase redirects here after magic-link / OAuth. We
// exchange the code for a session, then AUTO-CLAIM any warrens the user created anonymously
// (Phase 1: anonymous-first, nothing lost on sign-up). Then redirect to `next` (or home).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/?auth_error=exchange_failed", url.origin));
  }

  // Auto-claim anonymous warrens for this account (best-effort — never block sign-in on it).
  try {
    const anonId = (await cookies()).get(ANON_COOKIE)?.value;
    if (anonId) await claimAnonWarrens(anonId, data.user.id);
  } catch {
    // A claim failure shouldn't strand the user unauthenticated; they're signed in either way.
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
