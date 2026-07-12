import { describe, it, expect, vi, beforeEach } from "vitest";

// Configurable Supabase mock: captures filters and returns queued rows/results.
const state = vi.hoisted(() => ({
  cardRow: null as Record<string, unknown> | null,
  listRows: [] as Record<string, unknown>[],
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  count: 0,
  captured: {} as Record<string, unknown>,
}));

function chain() {
  const c: Record<string, unknown> = {};
  c.select = vi.fn((_cols?: string, opts?: { head?: boolean }) => {
    if (opts?.head) c.__head = true;
    return c;
  });
  c.eq = vi.fn((col: string, val: unknown) => {
    state.captured[col] = val;
    return c;
  });
  c.lte = vi.fn((col: string, val: unknown) => {
    state.captured[`lte:${col}`] = val;
    return c;
  });
  c.order = vi.fn(() => c);
  c.limit = vi.fn(() => c); // chainable (real builder allows .eq after .limit before await)
  c.insert = vi.fn((rows: unknown) => {
    state.captured.__insert = rows;
    return c;
  });
  c.update = vi.fn((patch: unknown) => {
    state.captured.__update = patch;
    return c;
  });
  c.maybeSingle = vi.fn(async () => ({ data: state.cardRow, error: null }));
  // Thenable: an insert().select() resolves insertResult; a head count resolves { count }.
  c.then = (resolve: (v: unknown) => unknown) => {
    if (c.__head) return resolve({ count: state.count, error: null });
    if (state.captured.__insert !== undefined) return resolve(state.insertResult);
    if (state.captured.__update !== undefined) return resolve(state.updateResult);
    return resolve({ data: state.listRows, error: null });
  };
  return c;
}
const from = vi.fn(() => chain());
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({ from }) }));

import { createCards, listDueCards, reviewCard, countDueCards, knowledgeMap } from "./repository";

const NOW = 1_800_000_000_000;

function cardRow(over: Record<string, unknown> = {}) {
  return {
    id: "c1", article: "Jazz", front: "Q", back: "A",
    owner_id: null, anon_id: "owner-anon",
    due: new Date(NOW - 1000).toISOString(),
    stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 0,
    reps: 0, lapses: 0, learning_steps: 0, state: 0, last_review: null,
    ...over,
  };
}

beforeEach(() => {
  state.cardRow = null;
  state.listRows = [];
  state.insertResult = { data: null, error: null };
  state.updateResult = { data: null, error: null };
  state.count = 0;
  state.captured = {};
  from.mockClear();
});

describe("createCards", () => {
  it("inserts cards owned by the account when signed in", async () => {
    state.insertResult = { data: [{ id: "1" }, { id: "2" }], error: null };
    const n = await createCards({ userId: "u1", anonId: "a1" }, "Jazz", [
      { front: "q1", back: "a1" },
      { front: "q2", back: "a2" },
    ]);
    expect(n).toBe(2);
    const rows = state.captured.__insert as Record<string, unknown>[];
    expect(rows[0].owner_id).toBe("u1"); // account preferred over anon
    expect(rows[0].anon_id).toBeUndefined();
    expect(rows[0].article).toBe("Jazz");
  });

  it("uses anon_id when there's no account", async () => {
    state.insertResult = { data: [{ id: "1" }], error: null };
    await createCards({ anonId: "a1" }, "Jazz", [{ front: "q", back: "a" }]);
    const rows = state.captured.__insert as Record<string, unknown>[];
    expect(rows[0].anon_id).toBe("a1");
  });

  it("no-ops without a viewer or with no cards", async () => {
    expect(await createCards({}, "Jazz", [{ front: "q", back: "a" }])).toBe(0);
    expect(await createCards({ userId: "u" }, "Jazz", [])).toBe(0);
  });
});

describe("listDueCards / countDueCards", () => {
  it("scopes the query to the owner and 'due <= now'", async () => {
    state.listRows = [cardRow()];
    const cards = await listDueCards({ anonId: "owner-anon" }, NOW);
    expect(cards).toHaveLength(1);
    expect(state.captured.anon_id).toBe("owner-anon");
    expect(state.captured["lte:due"]).toBe(new Date(NOW).toISOString());
  });

  it("counts due cards for the owner", async () => {
    state.count = 7;
    expect(await countDueCards({ userId: "u1" }, NOW)).toBe(7);
    expect(state.captured.owner_id).toBe("u1");
  });
});

describe("reviewCard (ownership + FSRS)", () => {
  it("reschedules and persists a card the viewer owns", async () => {
    state.cardRow = cardRow({ anon_id: "owner-anon" });
    const updated = await reviewCard({ anonId: "owner-anon" }, "c1", "good", NOW);
    expect(updated).not.toBeNull();
    expect(updated!.reps).toBe(1);
    expect(state.captured.__update).toBeDefined(); // an update was issued
  });

  it("returns null (no update) when the viewer doesn't own the card", async () => {
    state.cardRow = cardRow({ owner_id: "someone-else", anon_id: null });
    const updated = await reviewCard({ anonId: "attacker" }, "c1", "good", NOW);
    expect(updated).toBeNull();
    expect(state.captured.__update).toBeUndefined();
  });

  it("returns null when the card doesn't exist", async () => {
    state.cardRow = null;
    expect(await reviewCard({ anonId: "owner-anon" }, "missing", "good", NOW)).toBeNull();
  });
});

describe("knowledgeMap", () => {
  it("aggregates cards by article with best mastery, counts, and due", async () => {
    const now = NOW;
    state.listRows = [
      // Jazz: two cards, one mastered (stability high, Review), one new
      { article: "Jazz", due: new Date(now - 1000).toISOString(), state: 2, reps: 6, stability: 120 },
      { article: "Jazz", due: new Date(now + 100000).toISOString(), state: 0, reps: 0, stability: 0 },
      // Blues: one learning card, due now
      { article: "Blues", due: new Date(now - 500).toISOString(), state: 1, reps: 1, stability: 3 },
    ];
    const map = await knowledgeMap({ userId: "u1" }, now);
    expect(state.captured.owner_id).toBe("u1");
    expect(map.totalCards).toBe(3);
    expect(map.totalDue).toBe(2); // the two with due <= now
    expect(map.mastered).toBe(1); // Jazz
    // Jazz sorts first (mastered > learning); its mastery is the BEST across its cards.
    expect(map.topics[0].article).toBe("Jazz");
    expect(map.topics[0].mastery).toBe("mastered");
    expect(map.topics[0].cards).toBe(2);
    expect(map.topics[0].due).toBe(1);
    const blues = map.topics.find((t) => t.article === "Blues")!;
    expect(blues.mastery).toBe("learning");
  });

  it("returns an empty map without a viewer", async () => {
    const map = await knowledgeMap({}, NOW);
    expect(map).toEqual({ topics: [], totalCards: 0, totalDue: 0, mastered: 0 });
  });
});
