import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression test for a fixed ownership-bypass: setWarrenVisibility used to interpolate the
// client-controlled warren_anon cookie into a PostgREST .or() filter string, so a crafted
// cookie like "x,anon_id.not.is.null" injected an always-true term that matched EVERY
// anon-authored warren — letting an attacker publish/unpublish trails they don't own.
// The fix fetches the row and compares ownership in JS (no filter interpolation). These
// tests pin that the injection is now inert.

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
    state.captured.__or = expr; // must never be called with user input now
    return c;
  });
  c.update = vi.fn((patch: unknown) => {
    state.captured.__update = patch;
    return c;
  });
  c.maybeSingle = vi.fn(async () => {
    if (state.captured.__update !== undefined) return state.updateResult;
    return { data: state.warrenRow, error: null };
  });
  c.then = (resolve: (v: unknown) => unknown) => resolve(state.updateResult);
  return c;
}
const from = vi.fn(() => chain());
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({ from }) }));

import { setWarrenVisibility } from "./repository";

beforeEach(() => {
  state.warrenRow = null;
  state.updateResult = { data: null, error: null };
  state.captured = {};
  from.mockClear();
});

describe("ownership-bypass regression: crafted warren_anon cookie", () => {
  it("does NOT build a PostgREST .or() filter from the cookie value", async () => {
    state.warrenRow = { id: "victim", owner_id: null, anon_id: "real-owner" };
    await setWarrenVisibility("victim", { anonId: "x,anon_id.not.is.null" }, true);
    // The vulnerable .or() path is gone entirely.
    expect(state.captured.__or).toBeUndefined();
  });

  it("does not publish a warren the attacker doesn't own, even with an injection payload", async () => {
    state.warrenRow = { id: "victim", owner_id: null, anon_id: "real-owner" };
    const res = await setWarrenVisibility("victim", { anonId: "x,anon_id.not.is.null" }, true);
    expect(res.ok).toBe(false);
    // No update was issued for the unowned row.
    expect(state.captured.__update).toBeUndefined();
  });

  it("still lets the genuine owner publish (exact anon_id match)", async () => {
    state.warrenRow = { id: "mine", owner_id: null, anon_id: "real-owner" };
    const res = await setWarrenVisibility("mine", { anonId: "real-owner" }, true);
    expect(res.ok).toBe(true);
    expect(state.captured.__update).toEqual({ is_public: true });
  });
});
