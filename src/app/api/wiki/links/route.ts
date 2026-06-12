import { NextResponse, type NextRequest } from "next/server";
import { getArticleLinks } from "@/lib/wikipedia/client";

// GET /api/wiki/links?title=Black%20hole&limit=40
// Returns the in-article "blue links" (main-namespace only) you can burrow into.
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 40;
  try {
    const links = await getArticleLinks(title, limit);
    return NextResponse.json(
      { links },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=259200" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
