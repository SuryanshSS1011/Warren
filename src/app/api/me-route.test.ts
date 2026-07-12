import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const getProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/auth", () => ({ getUser }));
vi.mock("@/lib/billing/profile", () => ({ getProfile }));

import { GET } from "./me/route";

beforeEach(() => {
  getUser.mockReset();
  getProfile.mockReset();
});

describe("GET /api/me", () => {
  it("reports free + not signed in for an anonymous viewer", async () => {
    getUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ tier: "free", signedIn: false });
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("reports the effective tier for a signed-in user", async () => {
    getUser.mockResolvedValue({ id: "u" });
    getProfile.mockResolvedValue({
      id: "u", tier: "pro", trialEndsAt: null,
      lsCustomerId: null, lsSubscriptionId: null, lsStatus: null,
    });
    const res = await GET();
    expect(await res.json()).toEqual({ tier: "pro", signedIn: true });
  });

  it("reflects an active trial as pro", async () => {
    getUser.mockResolvedValue({ id: "u" });
    getProfile.mockResolvedValue({
      id: "u", tier: "free", trialEndsAt: Date.now() + 100000,
      lsCustomerId: null, lsSubscriptionId: null, lsStatus: null,
    });
    const res = await GET();
    expect((await res.json()).tier).toBe("pro");
  });

  it("never caches (private, no-store)", async () => {
    getUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
