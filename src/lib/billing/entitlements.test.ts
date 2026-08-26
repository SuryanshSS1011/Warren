import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const getProfile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/auth", () => ({ getUser }));
vi.mock("./profile", () => ({ getProfile }));

import { effectiveTier, can, currentTier, tierDisplay } from "./entitlements";

const NOW = 1_800_000_000_000;

beforeEach(() => {
  getUser.mockReset();
  getProfile.mockReset();
});

describe("effectiveTier", () => {
  it("is free for a profile-less (anonymous) viewer", () => {
    expect(effectiveTier(null, NOW)).toBe("free");
  });

  it("grants Pro during an active reverse trial on a free profile", () => {
    const p = { id: "u", tier: "free" as const, trialEndsAt: NOW + 1000, lsCustomerId: null, lsSubscriptionId: null, lsStatus: null };
    expect(effectiveTier(p, NOW)).toBe("pro");
  });

  it("falls back to the stored tier once the trial expires", () => {
    const p = { id: "u", tier: "free" as const, trialEndsAt: NOW - 1000, lsCustomerId: null, lsSubscriptionId: null, lsStatus: null };
    expect(effectiveTier(p, NOW)).toBe("free");
  });

  it("never downgrades a paid tier because of trial logic", () => {
    const p = { id: "u", tier: "researcher" as const, trialEndsAt: NOW + 1000, lsCustomerId: null, lsSubscriptionId: null, lsStatus: null };
    expect(effectiveTier(p, NOW)).toBe("researcher");
  });
});

describe("can", () => {
  it("returns false for anonymous users on any gated feature", async () => {
    getUser.mockResolvedValue(null);
    expect(await can("tts")).toBe(false);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("honors the effective tier for a signed-in user", async () => {
    getUser.mockResolvedValue({ id: "u" });
    getProfile.mockResolvedValue({ id: "u", tier: "pro", trialEndsAt: null, lsCustomerId: null, lsSubscriptionId: null, lsStatus: null });
    expect(await can("tts")).toBe(true);
    expect(await can("citation_explorer")).toBe(false);
  });

  it("a trialing free user gets Pro features", async () => {
    getUser.mockResolvedValue({ id: "u" });
    getProfile.mockResolvedValue({ id: "u", tier: "free", trialEndsAt: Date.now() + 100000, lsCustomerId: null, lsSubscriptionId: null, lsStatus: null });
    expect(await can("export")).toBe(true);
  });
});

describe("currentTier", () => {
  it("is free for anonymous", async () => {
    getUser.mockResolvedValue(null);
    expect(await currentTier()).toBe("free");
  });
});

describe("tierDisplay", () => {
  const prof = (over: Record<string, unknown>) => ({
    id: "u", tier: "free" as const, trialEndsAt: null, lsCustomerId: null,
    lsSubscriptionId: null, lsStatus: null, ...over,
  });

  it("reports an active trial with days remaining", () => {
    const d = tierDisplay(prof({ trialEndsAt: NOW + 3 * 24 * 60 * 60 * 1000 }), NOW);
    expect(d.tier).toBe("pro");
    expect(d.onTrial).toBe(true);
    expect(d.trialDaysLeft).toBe(3);
  });

  it("reports free with no trial once expired", () => {
    const d = tierDisplay(prof({ trialEndsAt: NOW - 1000 }), NOW);
    expect(d.tier).toBe("free");
    expect(d.onTrial).toBe(false);
    expect(d.trialDaysLeft).toBe(0);
  });

  it("a paid subscriber is not shown as on-trial", () => {
    const d = tierDisplay(prof({ tier: "pro", trialEndsAt: NOW + 100000 }), NOW);
    expect(d.tier).toBe("pro");
    expect(d.onTrial).toBe(false);
  });

  it("anonymous/profile-less is free", () => {
    expect(tierDisplay(null, NOW)).toEqual({ tier: "free", onTrial: false, trialDaysLeft: 0 });
  });
});
