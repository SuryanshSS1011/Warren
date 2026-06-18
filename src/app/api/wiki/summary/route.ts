import { NextResponse, type NextRequest } from "next/server";
import { getArticleLinks, getPageSummary } from "@/lib/wikipedia/client";
import { categorizeArticle } from "@/lib/ai/categorization";

// GET /api/wiki/summary?title=Black%20hole
// Proxies the Wikimedia REST summary so the browser never hits Wikipedia directly.
// Enriches the summary with AI-powered categorization based on the user's taxonomy.
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

    // Call AI to categorize based on title + short description
    const aiCategory = await categorizeArticle(summary.title, summary.description);

    return NextResponse.json(
      { ...summary, aiCategory },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
