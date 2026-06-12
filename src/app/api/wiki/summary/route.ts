import { NextResponse, type NextRequest } from "next/server";
import { getArticleLinks, getPageSummary } from "@/lib/wikipedia/client";

// GET /api/wiki/summary?title=Black%20hole
// Proxies the Wikimedia REST summary so the browser never hits Wikipedia directly.
// When the title resolves to a disambiguation page, surface a chooser list rather than
// passing it through as a normal article (approach from the graphui branch).
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
    if (summary.type === "disambiguation") {
      const links = await getArticleLinks(summary.title, 8);
      return NextResponse.json(
        {
          type: "disambiguation",
          title: summary.title,
          extract: summary.extract,
          suggestions: links.map((l) => ({ title: l.title })),
        },
        { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
      );
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
