import { NextResponse, type NextRequest } from "next/server";
import {
  billingConfigured,
  parseWebhook,
  verifyWebhookSignature,
} from "@/lib/billing/lemonsqueezy";
import { setProfileBilling } from "@/lib/billing/profile";

// POST /api/billing/webhook — LemonSqueezy subscription events. We verify the HMAC signature
// over the RAW body (never trust an unsigned webhook — it grants paid tiers), then map the
// event to a tier and persist it. Returns 503 when billing isn't configured, 401 on a bad
// signature, 200 once handled.
export async function POST(req: NextRequest) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }

  // Raw body is required for signature verification — do not use req.json() first.
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { userId, tier, status, customerId, subscriptionId } = parseWebhook(payload);
  if (!userId) {
    // No user attribution — acknowledge so LS doesn't retry forever, but nothing to apply.
    return NextResponse.json({ ok: true, applied: false });
  }

  try {
    await setProfileBilling(userId, {
      ...(tier ? { tier } : {}),
      ...(status ? { lsStatus: status } : {}),
      ...(customerId ? { lsCustomerId: customerId } : {}),
      ...(subscriptionId ? { lsSubscriptionId: subscriptionId } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "apply failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, applied: true });
}
