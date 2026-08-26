import { describe, it, expect, vi, beforeEach } from "vitest";

// Tailored Supabase mock for the owner-listing query: warren select (filtered by owner_id,
// ordered, limited) resolves to `warrens`; the node .in() select resolves to `nodes`.
const state = vi.hoisted(() => ({
  warrens: [] as unknown[],
  nodes: [] as unknown[],
  capturedOwner: undefined as unknown,
}));

function warrenChain() {
  const c: Record<string, unknown> = {};
  c.select = vi.fn(() => c);
  c.eq = vi.fn((col: string, val: unknown) => {
    if (col === "owner_id") state.capturedOwner = val;
    return c;
  });
  c.order = vi.fn(() => c);
  c.limit = vi.fn(() => Promise.resolve({ data: state.warrens, error: null }));
  return c;
}
function nodeChain() {
  const c: Record<string, unknown> = {};
  c.select = vi.fn(() => c);
  c.in = vi.fn(() => Promise.resolve({ data: state.nodes, error: null }));
  return c;
}

const from = vi.fn((table: string) => (table === "warren" ? warrenChain() : nodeChain()));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({ from }) }));

import { listWarrensForOwner } from "./repository";

beforeEach(() => {
  state.warrens = [];
  state.nodes = [];
  state.capturedOwner = undefined;
  from.mockClear();
});

describe("listWarrensForOwner", () => {
  it("returns [] and does not query without an ownerId", async () => {
    expect(await listWarrensForOwner("")).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("scopes the query to the owner and maps cards with the public flag", async () => {
    state.warrens = [
      {
        id: "w1",
        title: "Jazz Run",
        spine: ["n1", "n2"],
        stats: { hops: 1, categories: 2, minutes: 3, stars: 4 },
        created_at: new Date(0).toISOString(),
        is_public: false,
      },
    ];
    state.nodes = [
      { warren_id: "w1", id: "n1", title: "Jazz", category: "Music" },
      { warren_id: "w1", id: "n2", title: "Blues", category: "Music" },
    ];
    const cards = await listWarrensForOwner("user-1");
    expect(state.capturedOwner).toBe("user-1");
    expect(cards).toHaveLength(1);
    expect(cards[0].isPublic).toBe(false);
    expect(cards[0].title).toBe("Jazz Run");
    expect(cards[0].trail.map((t) => t.title)).toEqual(["Jazz", "Blues"]);
  });

  it("returns [] when the owner has no warrens", async () => {
    state.warrens = [];
    expect(await listWarrensForOwner("user-1")).toEqual([]);
  });
});
