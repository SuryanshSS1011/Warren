import { NextResponse, type NextRequest } from "next/server";
import { onThisDay, trending, randomArticle } from "@/lib/wikipedia/discover";

// GET /api/discover?kind=on-this-day|trending|random — free-tier discovery feeds from the
// Wikimedia feed APIs (cached in the lib layer). No auth, no entitlement — this is top-of-funnel.
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  try {
    if (kind === "random") {
      const item = await randomArticle();
      // Random is intentionally uncached.
      return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
    }
    if (kind === "on-this-day") {
      return NextResponse.json(
        { items: await onThisDay() },
        { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
      );
    }
    if (kind === "trending") {
      return NextResponse.json(
        { items: await trending() },
        { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } },
      );
    }
    return NextResponse.json({ error: "kind must be on-this-day, trending, or random" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
