import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  newCardState,
  review,
  masteryOf,
  MASTERY_RANK,
  type CardState,
  type ReviewRating,
  type Mastery,
} from "./scheduler";
import type { Flashcard } from "@/lib/ai/flashcards";
import type { Viewer } from "@/lib/explore/repository";

// Learn persistence. Cards are owner-scoped like warrens (account owner_id OR anon_id). All
// access goes through the service-role client (RLS is a backstop), with ownership enforced in
// app code via fetch-then-compare / scoped filters — the same injection-safe pattern as warrens.

export type StoredCard = { id: string; article: string; front: string; back: string } & CardState;

/** Columns ↔ CardState mapping (snake_case DB → our state shape). */
function rowToCard(r: Record<string, unknown>): StoredCard {
  return {
    id: r.id as string,
    article: r.article as string,
    front: r.front as string,
    back: r.back as string,
    due: new Date(r.due as string).getTime(),
    stability: r.stability as number,
    difficulty: r.difficulty as number,
    elapsed_days: r.elapsed_days as number,
    scheduled_days: r.scheduled_days as number,
    reps: r.reps as number,
    lapses: r.lapses as number,
    learning_steps: r.learning_steps as number,
    state: r.state as number,
    last_review: r.last_review ? new Date(r.last_review as string).getTime() : null,
  };
}

function stateColumns(s: CardState) {
  return {
    due: new Date(s.due).toISOString(),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learning_steps,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review).toISOString() : null,
  };
}

function ownerColumns(viewer: Viewer): { owner_id?: string; anon_id?: string } {
  // Prefer the account owner; fall back to the anon cookie. (A signed-in user always has both.)
  return viewer.userId ? { owner_id: viewer.userId } : { anon_id: viewer.anonId };
}

/** Insert generated flashcards for `article`, owned by `viewer`. Returns the count inserted. */
export async function createCards(
  viewer: Viewer,
  article: string,
  cards: Flashcard[],
  now: number = Date.now(),
): Promise<number> {
  const db = getAdminClient();
  if (!db || (!viewer.userId && !viewer.anonId) || cards.length === 0) return 0;
  const owner = ownerColumns(viewer);
  const rows = cards.map((c) => ({
    ...owner,
    article,
    front: c.front,
    back: c.back,
    ...stateColumns(newCardState(now)),
  }));
  const { data, error } = await db.from("card").insert(rows).select("id");
  if (error) throw new Error(`create cards: ${error.message}`);
  return data?.length ?? 0;
}

/** How many cards the viewer owns that are due at or before `now`. */
export async function countDueCards(viewer: Viewer, now: number = Date.now()): Promise<number> {
  const db = getAdminClient();
  if (!db || (!viewer.userId && !viewer.anonId)) return 0;
  let q = db.from("card").select("id", { count: "exact", head: true }).lte("due", new Date(now).toISOString());
  q = viewer.userId ? q.eq("owner_id", viewer.userId) : q.eq("anon_id", viewer.anonId!);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

/** The viewer's due cards (oldest-due first), capped at `limit`. */
export async function listDueCards(
  viewer: Viewer,
  now: number = Date.now(),
  limit = 30,
): Promise<StoredCard[]> {
  const db = getAdminClient();
  if (!db || (!viewer.userId && !viewer.anonId)) return [];
  let q = db
    .from("card")
    .select("*")
    .lte("due", new Date(now).toISOString())
    .order("due", { ascending: true })
    .limit(limit);
  q = viewer.userId ? q.eq("owner_id", viewer.userId) : q.eq("anon_id", viewer.anonId!);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(rowToCard);
}

/**
 * Apply a review rating to a card the viewer owns, reschedule via FSRS, and persist. Returns
 * the updated card, or null if it doesn't exist / isn't owned. Ownership is verified by
 * fetching the row and comparing in JS (no filter interpolation) — same pattern as warrens.
 */
export async function reviewCard(
  viewer: Viewer,
  cardId: string,
  rating: ReviewRating,
  now: number = Date.now(),
): Promise<StoredCard | null> {
  const db = getAdminClient();
  if (!db || (!viewer.userId && !viewer.anonId)) return null;

  const { data: row, error: readErr } = await db
    .from("card")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (readErr || !row) return null;

  const owns =
    (!!viewer.userId && row.owner_id === viewer.userId) ||
    (!!viewer.anonId && row.anon_id === viewer.anonId);
  if (!owns) return null;

  const current = rowToCard(row);
  const next = review(current, rating, now);

  const { error: updErr } = await db.from("card").update(stateColumns(next)).eq("id", cardId);
  if (updErr) throw new Error(`review card: ${updErr.message}`);
  return { ...current, ...next };
}

/** A topic in the "what you know" map: one article, aggregated across its cards. */
export type KnownTopic = {
  article: string;
  cards: number;
  due: number;
  mastery: Mastery; // the article's best mastery across its cards
};

export type KnowledgeMap = {
  topics: KnownTopic[]; // sorted: most-mastered first, then most cards
  totalCards: number;
  totalDue: number;
  mastered: number; // count of topics at "mastered"
};

/**
 * Aggregate the viewer's cards into the "what you know" map — the visible payoff of the
 * personal knowledge graph (PRODUCT_PLAN §6, the moat). Groups by article; an article's mastery
 * is the best across its cards. Owner-scoped. Cheap: one scoped read + in-JS aggregation.
 */
export async function knowledgeMap(
  viewer: Viewer,
  now: number = Date.now(),
): Promise<KnowledgeMap> {
  const empty: KnowledgeMap = { topics: [], totalCards: 0, totalDue: 0, mastered: 0 };
  const db = getAdminClient();
  if (!db || (!viewer.userId && !viewer.anonId)) return empty;

  let q = db.from("card").select("article, due, state, reps, stability");
  q = viewer.userId ? q.eq("owner_id", viewer.userId) : q.eq("anon_id", viewer.anonId!);
  const { data, error } = await q;
  if (error || !data) return empty;

  const byArticle = new Map<string, { cards: number; due: number; bestRank: number }>();
  let totalDue = 0;
  for (const r of data as { article: string; due: string; state: number; reps: number; stability: number }[]) {
    const m = masteryOf({ state: r.state, reps: r.reps, stability: r.stability });
    const isDueNow = new Date(r.due).getTime() <= now;
    if (isDueNow) totalDue++;
    const cur = byArticle.get(r.article) ?? { cards: 0, due: 0, bestRank: 0 };
    cur.cards += 1;
    if (isDueNow) cur.due += 1;
    cur.bestRank = Math.max(cur.bestRank, MASTERY_RANK[m]);
    byArticle.set(r.article, cur);
  }

  const rankToMastery = (Object.keys(MASTERY_RANK) as Mastery[]).reduce(
    (acc, k) => ((acc[MASTERY_RANK[k]] = k), acc),
    {} as Record<number, Mastery>,
  );

  const topics: KnownTopic[] = [...byArticle.entries()]
    .map(([article, v]) => ({
      article,
      cards: v.cards,
      due: v.due,
      mastery: rankToMastery[v.bestRank],
    }))
    .sort((a, b) => MASTERY_RANK[b.mastery] - MASTERY_RANK[a.mastery] || b.cards - a.cards);

  return {
    topics,
    totalCards: data.length,
    totalDue,
    mastered: topics.filter((t) => t.mastery === "mastered").length,
  };
}
