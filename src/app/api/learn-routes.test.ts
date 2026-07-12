import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const can = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const getArticleContent = vi.hoisted(() => vi.fn());
const generateFlashcards = vi.hoisted(() => vi.fn());
const createCards = vi.hoisted(() => vi.fn());
const countDueCards = vi.hoisted(() => vi.fn());
const listDueCards = vi.hoisted(() => vi.fn());
const reviewCard = vi.hoisted(() => vi.fn());
const checkAiRateLimit = vi.hoisted(() => vi.fn<() => Promise<unknown>>(async () => null));
const cookieStore = vi.hoisted(() => ({ value: "anon-1" as string | undefined }));

vi.mock("@/lib/billing/entitlements", () => ({ can }));
vi.mock("@/lib/supabase/auth", () => ({ getUser }));
vi.mock("@/lib/wikipedia/client", () => ({ getArticleContent }));
vi.mock("@/lib/ai/flashcards", () => ({ generateFlashcards }));
vi.mock("@/lib/learn/repository", () => ({ createCards, countDueCards, listDueCards, reviewCard }));
vi.mock("@/lib/ai/guard", () => ({ checkAiRateLimit }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

import { POST as cardsPOST } from "./learn/cards/route";
import { GET as reviewGET, POST as reviewPOST } from "./learn/review/route";

const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  can.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue(null);
  getArticleContent.mockReset();
  generateFlashcards.mockReset();
  createCards.mockReset();
  listDueCards.mockReset();
  reviewCard.mockReset();
  checkAiRateLimit.mockReset();
  checkAiRateLimit.mockResolvedValue(null);
  cookieStore.value = "anon-1";
});

describe("POST /api/learn/cards", () => {
  it("402s when not Pro", async () => {
    can.mockResolvedValue(false);
    const res = await cardsPOST(json("http://x/api/learn/cards", { title: "Jazz" }));
    expect(res.status).toBe(402);
    expect(getArticleContent).not.toHaveBeenCalled();
  });

  it("generates + saves cards for an entitled viewer", async () => {
    can.mockResolvedValue(true);
    getArticleContent.mockResolvedValue({ title: "Jazz", blocks: [{ type: "paragraph", spans: [{ text: "t" }] }] });
    generateFlashcards.mockResolvedValue([{ front: "q", back: "a" }]);
    createCards.mockResolvedValue(1);
    const res = await cardsPOST(json("http://x/api/learn/cards", { title: "Jazz" }));
    expect(res.status).toBe(200);
    expect((await res.json()).created).toBe(1);
    expect(createCards).toHaveBeenCalledWith(
      { anonId: "anon-1", userId: undefined }, "Jazz", [{ front: "q", back: "a" }],
    );
  });

  it("404s when the article has no content", async () => {
    can.mockResolvedValue(true);
    getArticleContent.mockResolvedValue({ title: "X", blocks: [] });
    expect((await cardsPOST(json("http://x/api/learn/cards", { title: "X" }))).status).toBe(404);
  });
});

describe("GET /api/learn/review", () => {
  it("402s when not Pro", async () => {
    can.mockResolvedValue(false);
    expect((await reviewGET()).status).toBe(402);
  });

  it("returns the viewer's due cards (id/front/back only)", async () => {
    can.mockResolvedValue(true);
    listDueCards.mockResolvedValue([
      { id: "c1", article: "Jazz", front: "q", back: "a", due: 0, stability: 1, difficulty: 1, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, learning_steps: 0, state: 0, last_review: null },
    ]);
    const res = await reviewGET();
    const body = await res.json();
    expect(body.cards[0]).toEqual({ id: "c1", article: "Jazz", front: "q", back: "a" });
  });
});

describe("POST /api/learn/review", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";

  it("402s when not Pro", async () => {
    can.mockResolvedValue(false);
    expect((await reviewPOST(json("http://x/api/learn/review", { cardId: uuid, rating: "good" }))).status).toBe(402);
  });

  it("400s on an invalid rating", async () => {
    can.mockResolvedValue(true);
    expect((await reviewPOST(json("http://x/api/learn/review", { cardId: uuid, rating: "maybe" }))).status).toBe(400);
  });

  it("404s when the card isn't the viewer's", async () => {
    can.mockResolvedValue(true);
    reviewCard.mockResolvedValue(null);
    expect((await reviewPOST(json("http://x/api/learn/review", { cardId: uuid, rating: "good" }))).status).toBe(404);
  });

  it("reschedules and returns the next due for an owned card", async () => {
    can.mockResolvedValue(true);
    reviewCard.mockResolvedValue({ id: uuid, due: 12345 });
    const res = await reviewPOST(json("http://x/api/learn/review", { cardId: uuid, rating: "good" }));
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ id: uuid, due: 12345 });
    expect(reviewCard).toHaveBeenCalledWith({ anonId: "anon-1", userId: undefined }, uuid, "good");
  });
});
