import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const billingConfigured = vi.hoisted(() => vi.fn(() => true));
const verifyWebhookSignature = vi.hoisted(() => vi.fn());
const parseWebhook = vi.hoisted(() => vi.fn());
const createCheckoutUrl = vi.hoisted(() => vi.fn());
const setProfileBilling = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/billing/lemonsqueezy", () => ({
  billingConfigured,
  verifyWebhookSignature,
  parseWebhook,
  createCheckoutUrl,
}));
vi.mock("@/lib/billing/profile", () => ({ setProfileBilling }));
vi.mock("@/lib/supabase/auth", () => ({ getUser }));
vi.mock("@/lib/env/public", () => ({
  getPublicEnv: () => ({ NEXT_PUBLIC_APP_URL: "http://x" }),
}));

import { POST as webhookPOST } from "./billing/webhook/route";
import { POST as checkoutPOST } from "./billing/checkout/route";

function webhookReq(body: string, sig = "sig") {
  return new NextRequest("http://x/api/billing/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": sig },
    body,
  });
}
function checkoutReq(body: unknown) {
  return new NextRequest("http://x/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  billingConfigured.mockReturnValue(true);
  verifyWebhookSignature.mockReset();
  parseWebhook.mockReset();
  createCheckoutUrl.mockReset();
  setProfileBilling.mockReset();
  getUser.mockReset();
});

describe("POST /api/billing/webhook", () => {
  it("503s when billing is unconfigured", async () => {
    billingConfigured.mockReturnValue(false);
    const res = await webhookPOST(webhookReq("{}"));
    expect(res.status).toBe(503);
  });

  it("401s on an invalid signature and never applies", async () => {
    verifyWebhookSignature.mockReturnValue(false);
    const res = await webhookPOST(webhookReq('{"x":1}'));
    expect(res.status).toBe(401);
    expect(setProfileBilling).not.toHaveBeenCalled();
  });

  it("applies the tier for a valid, signed event", async () => {
    verifyWebhookSignature.mockReturnValue(true);
    parseWebhook.mockReturnValue({
      userId: "user-1",
      tier: "pro",
      status: "active",
      customerId: "42",
      subscriptionId: "sub-1",
    });
    const res = await webhookPOST(webhookReq('{"real":"event"}'));
    expect(res.status).toBe(200);
    expect(setProfileBilling).toHaveBeenCalledWith("user-1", {
      tier: "pro",
      lsStatus: "active",
      lsCustomerId: "42",
      lsSubscriptionId: "sub-1",
    });
  });

  it("acknowledges (200, not applied) when no user is attributed", async () => {
    verifyWebhookSignature.mockReturnValue(true);
    parseWebhook.mockReturnValue({ userId: null, tier: "pro", status: "active", customerId: null, subscriptionId: null });
    const res = await webhookPOST(webhookReq('{"x":1}'));
    expect(res.status).toBe(200);
    expect((await res.json()).applied).toBe(false);
    expect(setProfileBilling).not.toHaveBeenCalled();
  });
});

describe("POST /api/billing/checkout", () => {
  it("401s when not signed in", async () => {
    getUser.mockResolvedValue(null);
    const res = await checkoutPOST(checkoutReq({ tier: "pro" }));
    expect(res.status).toBe(401);
  });

  it("400s on an invalid tier", async () => {
    getUser.mockResolvedValue({ id: "u", email: "a@b.co" });
    const res = await checkoutPOST(checkoutReq({ tier: "free" }));
    expect(res.status).toBe(400);
  });

  it("returns a checkout url for a valid request", async () => {
    getUser.mockResolvedValue({ id: "u", email: "a@b.co" });
    createCheckoutUrl.mockResolvedValue("https://checkout.example/abc");
    const res = await checkoutPOST(checkoutReq({ tier: "pro" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://checkout.example/abc");
    expect(createCheckoutUrl).toHaveBeenCalledWith("pro", "u", "a@b.co", "http://x/my");
  });

  it("502s when checkout creation fails", async () => {
    getUser.mockResolvedValue({ id: "u", email: "a@b.co" });
    createCheckoutUrl.mockResolvedValue(null);
    const res = await checkoutPOST(checkoutReq({ tier: "researcher" }));
    expect(res.status).toBe(502);
  });
});
