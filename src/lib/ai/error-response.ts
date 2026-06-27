import { NextResponse } from "next/server";

/**
 * Map a thrown AI-provider error to a clean API response. Quota / rate-limit errors become
 * a 429 with a friendly message (so the client can show "try again in a moment" instead of
 * a hard failure); everything else is a 502. We never echo the raw provider error body —
 * it can contain upstream JSON / internal details.
 */
export function aiErrorResponse(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  const isQuota =
    /\b429\b/.test(msg) ||
    /quota|rate.?limit|resource_exhausted|too many requests/i.test(msg);

  if (isQuota) {
    return NextResponse.json(
      { error: "AI quota reached — try again in a moment." },
      { status: 429 },
    );
  }
  return NextResponse.json({ error: "AI is temporarily unavailable." }, { status: 502 });
}
