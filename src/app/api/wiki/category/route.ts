import { NextResponse, type NextRequest } from "next/server";
import { getArticleCategory } from "@/lib/wikipedia/client";

// GET /api/wiki/category?title=Black%20hole
// The article's top real Wikipedia category (for coloring live nodes by Wikipedia's
// own taxonomy rather than a fixed enum).
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  try {
    const category = await getArticleCategory(title);
    return NextResponse.json(
      { category },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
