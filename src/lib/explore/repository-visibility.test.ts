import { describe, it, expect, vi, beforeEach } from "vitest";

// A minimal chainable Supabase query-builder mock. Each terminal (maybeSingle) resolves
// with whatever the test queued. update()/eq()/select() return the same chain.
const state = vi.hoisted(() => ({
  warrenRow: null as Record<string, unknown> | null,
  updateResult: { data: null as unknown, error: null as unknown },
  captured: {} as Record<string, unknown>,
}));

function chain() {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.select = vi.fn(self);
  c.eq = vi.fn((col: string, val: unknown) => {
    state.captured[col] = val;
    return c;
  });
  c.update = vi.fn((patch: unknown) => {
    state.captured.__update = patch;
    return c;
  });
  c.insert = vi.fn(self);
  c.delete = vi.fn(self);
  c.maybeSingle = vi.fn(async () => {
    if (state.captured.__update !== undefined) return state.updateResult;
    return { data: state.warrenRow, error: null };
  });
  return c;
}

const from = vi.fn(() => chain());
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from }),
}));

import { setWarrenVisibility, loadWarren } from "./repository";

beforeEach(() => {
  state.warrenRow = null;
  state.updateResult = { data: null, error: null };
  state.captured = {};
  from.mockClear();
});

describe("setWarrenVisibility", () => {
  it("scopes the update to id AND anon_id (owner-only) and reports ok on a hit", async () => {
    state.updateResult = { data: { id: "w1" }, error: null };
    const r = await setWarrenVisibility("w1", "anon-1", true);
    expect(r.ok).toBe(true);
    expect(state.captured.id).toBe("w1");
    expect(state.captured.anon_id).toBe("anon-1");
    expect(state.captured.__update).toEqual({ is_public: true });
  });

  it("reports ok:false when no owned row matched", async () => {
    state.updateResult = { data: null, error: null };
    const r = await setWarrenVisibility("w1", "not-owner", false);
    expect(r.ok).toBe(false);
  });
});

describe("loadWarren visibility", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "w1",
    title: "T",
    spine: ["n1"],
    started_at: new Date(0).toISOString(),
    stats: { hops: 0, categories: 0, minutes: 0, stars: 1 },
    anon_id: "owner",
    is_public: false,
    ...over,
  });

  it("returns a public warren to anyone", async () => {
    state.warrenRow = row({ is_public: true });
    const w = await loadWarren("w1");
    expect(w).not.toBeNull();
    expect(w?.isPublic).toBe(true);
    expect(w?.isOwner).toBe(false);
  });

  it("hides a private warren from a non-owner", async () => {
    state.warrenRow = row({ is_public: false });
    expect(await loadWarren("w1", "someone-else")).toBeNull();
  });

  it("shows a private warren to its owner and flags ownership", async () => {
    state.warrenRow = row({ is_public: false });
    const w = await loadWarren("w1", "owner");
    expect(w).not.toBeNull();
    expect(w?.isOwner).toBe(true);
    expect(w?.isPublic).toBe(false);
  });
});
