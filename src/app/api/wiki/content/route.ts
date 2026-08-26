import { NextResponse, type NextRequest } from "next/server";
import { getArticleContent } from "@/lib/wikipedia/client";

// GET /api/wiki/content?title=Black%20hole — full article prose as a SAFE block model for the
// native reader (paragraphs/headings + article links; no raw HTML). Replaces /api/wiki/render
// (the sandboxed-iframe proxy). Reading happens natively in Warren typography.
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  try {
    const content = await getArticleContent(title);
    if (!content) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(content, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
