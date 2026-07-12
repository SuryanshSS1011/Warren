import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getUser } from "@/lib/supabase/auth";
import { can } from "@/lib/billing/entitlements";
import { listDueCards, reviewCard } from "@/lib/learn/repository";
import { isReviewRating } from "@/lib/learn/scheduler";

const ANON_COOKIE = "warren_anon";

async function viewer() {
  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  const user = await getUser();
  return { anonId, userId: user?.id, signedIn: !!user || !!anonId };
}

// GET /api/learn/review — the viewer's due cards to study. Pro feature. Fronts only would be
// nicer for anti-peek, but the study UI flips locally; we send front+back.
export async function GET() {
  if (!(await can("spaced_repetition"))) {
    return NextResponse.json({ error: "Learn is a Pro feature." }, { status: 402 });
  }
  const v = await viewer();
  if (!v.signedIn) return NextResponse.json({ cards: [] });
  const cards = await listDueCards({ anonId: v.anonId, userId: v.userId });
  // Send only what the UI needs (id, front, back).
  return NextResponse.json({
    cards: cards.map((c) => ({ id: c.id, article: c.article, front: c.front, back: c.back })),
  });
}

const ReviewBody = z.object({
  cardId: z.uuid(),
  rating: z.string().refine(isReviewRating, "rating must be again|hard|good|easy"),
});

// POST /api/learn/review — submit a rating for a card; FSRS reschedules it. Returns the next
// due time. Pro feature; owner-only (enforced in reviewCard).
export async function POST(req: NextRequest) {
  if (!(await can("spaced_repetition"))) {
    return NextResponse.json({ error: "Learn is a Pro feature." }, { status: 402 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = ReviewBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const v = await viewer();
  if (!v.signedIn) return NextResponse.json({ error: "no session" }, { status: 401 });

  const updated = await reviewCard(
    { anonId: v.anonId, userId: v.userId },
    parsed.data.cardId,
    parsed.data.rating as "again" | "hard" | "good" | "easy",
  );
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ id: updated.id, due: updated.due });
}
