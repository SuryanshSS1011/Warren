import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/cache/redis";

// Per-client cap on AI generations before any paywall exists (Phase 0 abuse guard). Keyed by
// client IP; generous enough for real exploration, low enough to blunt scripted abuse. Tune
// as usage data arrives; a real per-account quota replaces this when tiers ship (Phase 2).
const AI_LIMIT = 60;
const AI_WINDOW_SECONDS = 60 * 60; // 60 generations / hour / IP

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers.get("x-real-ip")?.trim();
  return real || "unknown";
}

/**
 * Enforce the AI rate limit for a request. Returns a 429 Response to short-circuit the
 * handler when over the limit, or null to proceed. `bucket` namespaces the counter per route
 * (bridge/title/narrative) so one heavy surface doesn't starve the others.
 */
export async function checkAiRateLimit(
  req: NextRequest,
  bucket: string,
): Promise<NextResponse | null> {
  const { ok } = await rateLimit(`ai:${bucket}:${clientIp(req)}`, AI_LIMIT, AI_WINDOW_SECONDS);
  if (ok) return null;
  return NextResponse.json(
    { error: "AI quota reached — try again in a little while." },
    { status: 429, headers: { "Retry-After": String(AI_WINDOW_SECONDS) } },
  );
}
