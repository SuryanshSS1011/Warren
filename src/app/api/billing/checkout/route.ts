import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/auth";
import { getPublicEnv } from "@/lib/env/public";
import { billingConfigured, createCheckoutUrl } from "@/lib/billing/lemonsqueezy";

const Body = z.object({ tier: z.enum(["pro", "researcher"]) });

// POST /api/billing/checkout — create a LemonSqueezy checkout URL for the signed-in user and
// chosen paid tier. Requires an account (you must be signed in to pay). Returns { url }.
export async function POST(req: NextRequest) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "sign in to upgrade" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const redirectUrl = `${NEXT_PUBLIC_APP_URL}/my`;
  const url = await createCheckoutUrl(parsed.data.tier, user.id, user.email, redirectUrl);
  if (!url) {
    return NextResponse.json({ error: "couldn't create checkout" }, { status: 502 });
  }
  return NextResponse.json({ url });
}
