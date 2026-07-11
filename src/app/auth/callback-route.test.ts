import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const claimAnonWarrens = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ value: "anon-1" as string | undefined }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));
vi.mock("@/lib/explore/repository", () => ({ claimAnonWarrens }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

import { GET } from "./callback/route";

const req = (qs: string) => new NextRequest(`http://x/auth/callback${qs}`);

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  claimAnonWarrens.mockReset();
  claimAnonWarrens.mockResolvedValue(2);
  cookieStore.value = "anon-1";
});

describe("GET /auth/callback", () => {
  it("redirects home with an error when no code is present", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("auth_error=missing_code");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects with an error when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: new Error("bad") });
    const res = await GET(req("?code=abc"));
    expect(res.headers.get("location")).toContain("auth_error=exchange_failed");
  });

  it("exchanges the code, claims anon warrens, and redirects to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-9" } }, error: null });
    const res = await GET(req("?code=abc&next=/my"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(claimAnonWarrens).toHaveBeenCalledWith("anon-1", "user-9");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/my");
  });

  it("still signs in when there is no anon cookie to claim", async () => {
    cookieStore.value = undefined;
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-9" } }, error: null });
    const res = await GET(req("?code=abc"));
    expect(claimAnonWarrens).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://x/");
  });

  it("does not fail sign-in if the claim throws", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-9" } }, error: null });
    claimAnonWarrens.mockRejectedValue(new Error("db down"));
    const res = await GET(req("?code=abc&next=/my"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/my");
  });

  describe("open-redirect protection on `next`", () => {
    beforeEach(() => {
      exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u" } }, error: null });
    });

    it("allows a same-origin path", async () => {
      const res = await GET(req("?code=abc&next=/my"));
      expect(res.headers.get("location")).toBe("http://x/my");
    });

    it.each([
      ["https://evil.com/phish", "absolute URL"],
      ["//evil.com", "protocol-relative host"],
      ["/\\evil.com", "backslash host trick"],
      ["http://evil.com", "http absolute"],
    ])("rejects %s (%s) and falls back to home", async (payload) => {
      const res = await GET(req(`?code=abc&next=${encodeURIComponent(payload)}`));
      expect(res.headers.get("location")).toBe("http://x/");
    });
  });
});
