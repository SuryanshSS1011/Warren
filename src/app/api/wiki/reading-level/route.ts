import { NextResponse, type NextRequest } from "next/server";
import { getArticleContent } from "@/lib/wikipedia/client";
import { blocksToText } from "@/lib/wikipedia/content";
import { rewriteAtLevelAttributed, isReadingLevel } from "@/lib/ai/reading-level";
import { can } from "@/lib/billing/entitlements";
import { aiErrorResponse } from "@/lib/ai/error-response";
import { checkAiRateLimit } from "@/lib/ai/guard";

// GET /api/wiki/reading-level?title=Black%20hole&level=eli5 — the article rewritten at a
// reading level. Pro feature (entitlement "reading_level"). AI-modifies-CC-text surface:
// the response carries attribution + the AI-generated flag; the reader must label it as such.
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  const level = req.nextUrl.searchParams.get("level");
  if (!title || !level || !isReadingLevel(level)) {
    return NextResponse.json(
      { error: "title and level (eli5|simple|expert) are required" },
      { status: 400 },
    );
  }

  if (!(await can("reading_level"))) {
    return NextResponse.json({ error: "Reading levels are a Pro feature." }, { status: 402 });
  }

  const limited = await checkAiRateLimit(req, "reading-level");
  if (limited) return limited;

  try {
    const content = await getArticleContent(title);
    if (!content || content.blocks.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const sourceText = blocksToText(content.blocks);
    const { text, attribution } = await rewriteAtLevelAttributed(title, level, sourceText);
    return NextResponse.json(
      { text, level, attribution },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
