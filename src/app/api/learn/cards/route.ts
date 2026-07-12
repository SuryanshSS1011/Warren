import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getUser } from "@/lib/supabase/auth";
import { can } from "@/lib/billing/entitlements";
import { checkAiRateLimit } from "@/lib/ai/guard";
import { aiErrorResponse } from "@/lib/ai/error-response";
import { getArticleContent } from "@/lib/wikipedia/client";
import { blocksToText } from "@/lib/wikipedia/content";
import { generateFlashcards } from "@/lib/ai/flashcards";
import { createCards, countDueCards } from "@/lib/learn/repository";

const ANON_COOKIE = "warren_anon";
const Body = z.object({ title: z.string().min(1).max(300) });

// POST /api/learn/cards — generate flashcards from an article and save them for the viewer.
// Pro feature ("spaced_repetition"), rate-limited. Returns { created }.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  if (!(await can("spaced_repetition"))) {
    return NextResponse.json({ error: "Learn is a Pro feature." }, { status: 402 });
  }
  const limited = await checkAiRateLimit(req, "cards");
  if (limited) return limited;

  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  const user = await getUser();
  if (!anonId && !user) return NextResponse.json({ error: "no session" }, { status: 401 });

  try {
    const content = await getArticleContent(parsed.data.title);
    if (!content || content.blocks.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const cards = await generateFlashcards(parsed.data.title, blocksToText(content.blocks));
    if (cards.length === 0) {
      return NextResponse.json({ error: "couldn't generate cards" }, { status: 502 });
    }
    const created = await createCards({ anonId, userId: user?.id }, parsed.data.title, cards);
    return NextResponse.json({ created });
  } catch (err) {
    return aiErrorResponse(err);
  }
}

// GET /api/learn/cards — the viewer's due-card count (cheap; for surfacing "N due").
export async function GET() {
  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  const user = await getUser();
  if (!anonId && !user) return NextResponse.json({ due: 0 });
  const due = await countDueCards({ anonId, userId: user?.id });
  return NextResponse.json({ due });
}
