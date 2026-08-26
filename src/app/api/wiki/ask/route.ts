import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getArticleContent } from "@/lib/wikipedia/client";
import { blocksToText } from "@/lib/wikipedia/content";
import { askArticleAttributed } from "@/lib/ai/ask-article";
import { can } from "@/lib/billing/entitlements";
import { aiErrorResponse } from "@/lib/ai/error-response";
import { checkAiRateLimit } from "@/lib/ai/guard";

const Body = z.object({
  title: z.string().min(1).max(300),
  question: z.string().min(1).max(400),
});

// POST /api/wiki/ask — answer a question grounded STRICTLY in the article's text (no external
// retrieval). Pro feature ("grounded_chat"), rate-limited (AI cost driver). Response carries
// attribution + the AI-generated flag; the UI labels it "may contain errors".
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!(await can("grounded_chat"))) {
    return NextResponse.json({ error: "Grounded chat is a Pro feature." }, { status: 402 });
  }

  const limited = await checkAiRateLimit(req, "ask");
  if (limited) return limited;

  try {
    const content = await getArticleContent(parsed.data.title);
    if (!content || content.blocks.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const articleText = blocksToText(content.blocks);
    const { text, attribution } = await askArticleAttributed(
      parsed.data.title,
      parsed.data.question,
      articleText,
    );
    return NextResponse.json(
      { answer: text, attribution },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
