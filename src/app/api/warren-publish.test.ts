import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const setWarrenVisibility = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ value: "owner-anon" as string | undefined }));

vi.mock("@/lib/explore/repository", () => ({
  setWarrenVisibility,
  // Route imports this to distinguish 503; a real class instance isn't needed here.
  PersistenceUnavailableError: class PersistenceUnavailableError extends Error {},
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

import { POST } from "./warren/[id]/publish/route";

function req(body: unknown, raw = false) {
  return new NextRequest("http://x/api/warren/abc/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "abc" }) };

beforeEach(() => {
  setWarrenVisibility.mockReset();
  cookieStore.value = "owner-anon";
});

describe("POST /api/warren/[id]/publish", () => {
  it("publishes when the owner requests it", async () => {
    setWarrenVisibility.mockResolvedValue({ ok: true });
    const res = await POST(req({ isPublic: true }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "abc", isPublic: true });
    expect(setWarrenVisibility).toHaveBeenCalledWith("abc", "owner-anon", true);
  });

  it("401s when there is no session cookie", async () => {
    cookieStore.value = undefined;
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

  it("400s on malformed json", async () => {
    const res = await POST(req("{bad", true), ctx);
    expect(res.status).toBe(400);
  });
});
