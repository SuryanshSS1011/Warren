import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import type { Tier } from "./tiers";

// All LemonSqueezy specifics live here so the rest of billing stays vendor-neutral.

export function billingConfigured(): boolean {
  const env = getServerEnv();
  return !!(env.LEMONSQUEEZY_API_KEY && env.LEMONSQUEEZY_STORE_ID);
}

/** The LS variant id for a paid tier, or null if not configured. */
export function variantForTier(tier: Tier): string | null {
  const env = getServerEnv();
  if (tier === "pro") return env.LEMONSQUEEZY_VARIANT_PRO ?? null;
  if (tier === "researcher") return env.LEMONSQUEEZY_VARIANT_RESEARCHER ?? null;
  return null;
}

/** Map an LS variant id back to the tier it grants (for webhook handling). */
export function tierForVariant(variantId: string): Tier | null {
  const env = getServerEnv();
  if (variantId && variantId === env.LEMONSQUEEZY_VARIANT_PRO) return "pro";
  if (variantId && variantId === env.LEMONSQUEEZY_VARIANT_RESEARCHER) return "researcher";
  return null;
}

/**
 * Create a hosted checkout URL for `tier`, tagging it with `userId` in custom data so the
 * webhook can attribute the resulting subscription to the account. Returns null when billing
 * is unconfigured. `redirectUrl` is where LS returns the user after payment.
 */
export async function createCheckoutUrl(
  tier: Tier,
  userId: string,
  email: string | undefined,
  redirectUrl: string,
): Promise<string | null> {
  const env = getServerEnv();
  const variantId = variantForTier(tier);
  if (!billingConfigured() || !variantId) return null;

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            // custom is echoed back on webhook events → attribute to the user.
            custom: { user_id: userId },
          },
          product_options: { redirect_url: redirectUrl },
        },
        relationships: {
          store: { data: { type: "stores", id: String(env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  return json.data?.attributes?.url ?? null;
}

/**
 * Verify an LS webhook's HMAC-SHA256 signature (hex `X-Signature` header) against the raw
 * request body using the configured webhook secret. Constant-time compare. Returns false when
 * unconfigured or on any mismatch.
 */
export function verifyWebhookSignature(rawBody: string, signatureHex: string | null): boolean {
  const secret = getServerEnv().LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signatureHex) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export type LsWebhookResult = {
  userId: string | null;
  tier: Tier | null;
  status: string | null;
  customerId: string | null;
  subscriptionId: string | null;
};

/**
 * Extract the account-relevant bits from a parsed LS webhook payload. Subscription events
 * carry the variant (→ tier), status, ids, and our custom user_id. On a cancellation/expiry
 * the tier falls back to `free`.
 */
export function parseWebhook(payload: unknown): LsWebhookResult {
  const p = payload as {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: {
      id?: string;
      attributes?: {
        status?: string;
        variant_id?: number | string;
        customer_id?: number | string;
      };
    };
  };
  const event = p.meta?.event_name ?? "";
  const attrs = p.data?.attributes ?? {};
  const status = attrs.status ?? null;

  let tier = attrs.variant_id != null ? tierForVariant(String(attrs.variant_id)) : null;
  // Terminal states revoke access regardless of variant.
  if (
    event === "subscription_expired" ||
    event === "subscription_cancelled" ||
    status === "expired" ||
    status === "cancelled"
  ) {
    tier = "free";
  }

  return {
    userId: p.meta?.custom_data?.user_id ?? null,
    tier,
    status,
    customerId: attrs.customer_id != null ? String(attrs.customer_id) : null,
    subscriptionId: p.data?.id ?? null,
  };
}
