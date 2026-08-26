import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";

/**
 * Refresh the Supabase auth session on each request and propagate refreshed cookies. Runs
 * from the root proxy (this Next version renames middleware → `proxy`). Anonymous users have
 * no session, so this is a cheap no-op for them; it only matters once a user signs in.
 *
 * IMPORTANT (Supabase SSR contract): the returned response's cookies must be the ones set
 * here — do not construct a fresh NextResponse afterward, or the refreshed session is lost.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getPublicEnv();

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger a token refresh when needed. Do not run logic between client
  // creation and this call (Supabase SSR guidance) to avoid hard-to-debug session bugs.
  await supabase.auth.getUser();

  return response;
}
