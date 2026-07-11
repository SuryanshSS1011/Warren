import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const env = vi.hoisted(() => ({
  value: {
    LEMONSQUEEZY_API_KEY: "key",
    LEMONSQUEEZY_STORE_ID: "store-1",
    LEMONSQUEEZY_WEBHOOK_SECRET: "shhh",
    LEMONSQUEEZY_VARIANT_PRO: "var-pro",
    LEMONSQUEEZY_VARIANT_RESEARCHER: "var-res",
  } as Record<string, string | undefined>,
}));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => env.value }));

import {
  billingConfigured,
  variantForTier,
  tierForVariant,
  verifyWebhookSignature,
  parseWebhook,
} from "./lemonsqueezy";

beforeEach(() => {
  env.value = {
    LEMONSQUEEZY_API_KEY: "key",
    LEMONSQUEEZY_STORE_ID: "store-1",
    LEMONSQUEEZY_WEBHOOK_SECRET: "shhh",
    LEMONSQUEEZY_VARIANT_PRO: "var-pro",
    LEMONSQUEEZY_VARIANT_RESEARCHER: "var-res",
  };
});

describe("configuration + variant mapping", () => {
  it("billingConfigured reflects key+store presence", () => {
    expect(billingConfigured()).toBe(true);
    env.value.LEMONSQUEEZY_API_KEY = undefined;
    expect(billingConfigured()).toBe(false);
  });

  it("maps tiers ↔ variants both ways", () => {
    expect(variantForTier("pro")).toBe("var-pro");
    expect(variantForTier("researcher")).toBe("var-res");
    expect(variantForTier("free")).toBeNull();
    expect(tierForVariant("var-pro")).toBe("pro");
    expect(tierForVariant("var-res")).toBe("researcher");
    expect(tierForVariant("unknown")).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  const sign = (body: string, secret: string) =>
    createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a correctly-signed body", () => {
    const body = '{"hello":"world"}';
    expect(verifyWebhookSignature(body, sign(body, "shhh"))).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const body = '{"hello":"world"}';
    expect(verifyWebhookSignature(body, sign(body, "wrong-secret"))).toBe(false);
  });

  it("rejects a tampered body", () => {
    const sig = sign('{"amount":5}', "shhh");
    expect(verifyWebhookSignature('{"amount":9999}', sig)).toBe(false);
  });

  it("rejects when signature header is missing", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects when webhook secret is unconfigured", () => {
    env.value.LEMONSQUEEZY_WEBHOOK_SECRET = undefined;
    expect(verifyWebhookSignature("{}", "abcd")).toBe(false);
  });

  it("rejects a non-hex signature without throwing", () => {
    expect(verifyWebhookSignature("{}", "not-hex-zzzz")).toBe(false);
  });
});

describe("parseWebhook", () => {
  const base = (event: string, attrs: Record<string, unknown>, userId = "user-1") => ({
    meta: { event_name: event, custom_data: { user_id: userId } },
    data: { id: "sub-123", attributes: attrs },
  });

  it("maps a subscription_created to the variant's tier + ids", () => {
    const r = parseWebhook(
      base("subscription_created", { status: "active", variant_id: "var-pro", customer_id: 42 }),
    );
    expect(r).toEqual({
      userId: "user-1",
      tier: "pro",
      status: "active",
      customerId: "42",
      subscriptionId: "sub-123",
    });
  });

  it("revokes to free on cancellation regardless of variant", () => {
    const r = parseWebhook(
      base("subscription_cancelled", { status: "cancelled", variant_id: "var-res" }),
    );
    expect(r.tier).toBe("free");
  });

  it("revokes to free on expiry", () => {
    const r = parseWebhook(base("subscription_expired", { status: "expired", variant_id: "var-pro" }));
    expect(r.tier).toBe("free");
  });

  it("returns null userId when custom_data is absent", () => {
    const r = parseWebhook({ meta: { event_name: "subscription_created" }, data: { attributes: {} } });
    expect(r.userId).toBeNull();
  });
});
