import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const setWarrenVisibility = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ value: "owner-anon" as string | undefined }));

vi.mock("@/lib/explore/repository", () => ({
  setWarrenVisibility,
  // Route imports this to distinguish 503; a real class instance isn't needed here.
  PersistenceUnavailableError: class PersistenceUnavailableError extends Error {},
}));
vi.mock("@/lib/supabase/auth", () => ({ getUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

import { POST } from "./warren/[id]/publish/route";

const WARREN_ID = "11111111-1111-4111-8111-111111111111";
function req(body: unknown, raw = false) {
  return new NextRequest(`http://x/api/warren/${WARREN_ID}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: WARREN_ID }) };

beforeEach(() => {
  setWarrenVisibility.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue(null); // anonymous by default
  cookieStore.value = "owner-anon";
});

describe("POST /api/warren/[id]/publish", () => {
  it("publishes when the anon owner requests it", async () => {
    setWarrenVisibility.mockResolvedValue({ ok: true });
    const res = await POST(req({ isPublic: true }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: WARREN_ID, isPublic: true });
    expect(setWarrenVisibility).toHaveBeenCalledWith(
      WARREN_ID,
      { anonId: "owner-anon", userId: undefined },
      true,
    );
  });

  it("publishes for a signed-in account even without an anon cookie", async () => {
    cookieStore.value = undefined;
    getUser.mockResolvedValue({ id: "user-1" });
    setWarrenVisibility.mockResolvedValue({ ok: true });
    const res = await POST(req({ isPublic: true }), ctx);
    expect(res.status).toBe(200);
    expect(setWarrenVisibility).toHaveBeenCalledWith(
      WARREN_ID,
      { anonId: undefined, userId: "user-1" },
      true,
    );
  });

  it("401s when there is neither a session cookie nor an account", async () => {
    cookieStore.value = undefined;
    getUser.mockResolvedValue(null);
    const res = await POST(req({ isPublic: true }), ctx);
    expect(res.status).toBe(401);
    expect(setWarrenVisibility).not.toHaveBeenCalled();
  });

  it("404s when the warren isn't owned by this anon (ok:false)", async () => {
    setWarrenVisibility.mockResolvedValue({ ok: false });
    const res = await POST(req({ isPublic: true }), ctx);
    expect(res.status).toBe(404);
  });

  it("400s on an invalid body", async () => {
    const res = await POST(req({ nope: 1 }), ctx);
    expect(res.status).toBe(400);
  });

  it("400s on a non-UUID warren id", async () => {
    const badReq = new NextRequest("http://x/api/warren/not-a-uuid/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: true }),
    });
    const res = await POST(badReq, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(400);
    expect(setWarrenVisibility).not.toHaveBeenCalled();
  });

  it("400s on malformed json", async () => {
    const res = await POST(req("{bad", true), ctx);
    expect(res.status).toBe(400);
  });
});
