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
  c.or = vi.fn((expr: string) => {
    state.captured.__or = expr;
    return c;
  });
  c.is = vi.fn((col: string, val: unknown) => {
    state.captured[`is:${col}`] = val;
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
  // Make the chain awaitable (Supabase builders are thenable) so a query that ends at
  // .select() without .maybeSingle() (e.g. claimAnonWarrens) resolves to the queued result.
  c.then = (resolve: (v: unknown) => unknown) => resolve(state.updateResult);
  return c;
}

const from = vi.fn(() => chain());
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from }),
}));

import { setWarrenVisibility, loadWarren, claimAnonWarrens } from "./repository";

beforeEach(() => {
  state.warrenRow = null;
  state.updateResult = { data: null, error: null };
  state.captured = {};
  from.mockClear();
});

describe("setWarrenVisibility", () => {
  it("publishes when the account owner matches (owner_id), never interpolating input", async () => {
    state.warrenRow = { id: "w1", owner_id: "user-1", anon_id: "anon-x" };
    const r = await setWarrenVisibility("w1", { userId: "user-1" }, true);
    expect(r.ok).toBe(true);
    // The update ran with the new visibility, scoped by id only (ownership already verified).
    expect(state.captured.__update).toEqual({ is_public: true });
    expect(state.captured.id).toBe("w1");
    // No PostgREST .or() filter string was built from user input.
    expect(state.captured.__or).toBeUndefined();
  });

  it("publishes when the anon cookie matches (anon_id)", async () => {
    state.warrenRow = { id: "w1", owner_id: null, anon_id: "anon-1" };
    const r = await setWarrenVisibility("w1", { anonId: "anon-1" }, true);
    expect(r.ok).toBe(true);
  });

  it("reports ok:false when the viewer does not own the row (no update runs)", async () => {
    state.warrenRow = { id: "w1", owner_id: "someone", anon_id: "someone-else" };
    const r = await setWarrenVisibility("w1", { anonId: "not-owner", userId: "not-owner" }, false);
    expect(r.ok).toBe(false);
    expect(state.captured.__update).toBeUndefined();
  });

  it("reports ok:false when the warren does not exist", async () => {
    state.warrenRow = null;
    expect((await setWarrenVisibility("w1", { anonId: "anon-1" }, true)).ok).toBe(false);
  });

  it("returns ok:false with no viewer at all", async () => {
    const r = await setWarrenVisibility("w1", {}, true);
    expect(r.ok).toBe(false);
  });

  it("SECURITY: a crafted anon_id cannot match a warren it doesn't own", async () => {
    // The row is owned by a real anon; the attacker supplies a cookie value crafted to look
    // like an injected PostgREST predicate. With fetch-then-compare it simply !== the real
    // anon_id, so no update happens.
    state.warrenRow = { id: "w1", owner_id: null, anon_id: "real-owner-anon" };
    const attacker = "x,is_public.eq.false";
    const r = await setWarrenVisibility("w1", { anonId: attacker }, true);
    expect(r.ok).toBe(false);
    expect(state.captured.__update).toBeUndefined();
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
    expect(await loadWarren("w1", { anonId: "someone-else" })).toBeNull();
  });

  it("shows a private warren to its anon owner and flags ownership", async () => {
    state.warrenRow = row({ is_public: false });
    const w = await loadWarren("w1", { anonId: "owner" });
    expect(w).not.toBeNull();
    expect(w?.isOwner).toBe(true);
    expect(w?.isPublic).toBe(false);
  });

  it("shows a private warren to its account owner (owner_id match)", async () => {
    state.warrenRow = row({ is_public: false, anon_id: null, owner_id: "user-9" });
    const w = await loadWarren("w1", { userId: "user-9" });
    expect(w).not.toBeNull();
    expect(w?.isOwner).toBe(true);
  });

  it("hides a private warren from a different account", async () => {
    state.warrenRow = row({ is_public: false, anon_id: null, owner_id: "user-9" });
    expect(await loadWarren("w1", { userId: "other-user" })).toBeNull();
  });
});

describe("claimAnonWarrens", () => {
  it("claims unowned warrens matching the anon id for the account, returns the count", async () => {
    state.updateResult = { data: [{ id: "w1" }, { id: "w2" }], error: null };
    const n = await claimAnonWarrens("anon-1", "user-1");
    expect(n).toBe(2);
    expect(state.captured.__update).toEqual({ owner_id: "user-1" });
    expect(state.captured.anon_id).toBe("anon-1");
    expect(state.captured["is:owner_id"]).toBeNull(); // only claim rows not yet owned
  });

  it("no-ops (0) when anonId or ownerId is missing", async () => {
    expect(await claimAnonWarrens("", "user-1")).toBe(0);
    expect(await claimAnonWarrens("anon-1", "")).toBe(0);
  });
});
