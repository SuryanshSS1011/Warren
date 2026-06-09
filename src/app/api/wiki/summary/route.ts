import { NextResponse, type NextRequest } from "next/server";
import { getPageSummary } from "@/lib/wikipedia/client";

// GET /api/wiki/summary?title=Black%20hole
// Proxies the Wikimedia REST summary so the browser never hits Wikipedia directly.
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  try {
    const summary = await getPageSummary(title);
    if (!summary) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
