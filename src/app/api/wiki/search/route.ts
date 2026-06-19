import { NextResponse, type NextRequest } from "next/server";
import { searchWikipedia } from "@/lib/wikipedia/client";

// GET /api/wiki/search?q=black%20hole — live Wikipedia title suggestions for the palette.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  try {
    const results = await searchWikipedia(q, 10);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error", results: [] },
      { status: 502 },
    );
  }
}
