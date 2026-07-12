import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { getProfile } from "@/lib/billing/profile";
import { effectiveTier } from "@/lib/billing/entitlements";

// GET /api/me — the viewer's effective tier + signed-in state, for CLIENT-SIDE gating of
// purely-client features (e.g. browser TTS, which has no server call to gate at). The tier is
// still computed server-side from the session/profile — the client can't fake it, it only
// reads what the server reports. Anonymous users are { tier: "free", signedIn: false }.
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { tier: "free", signedIn: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const tier = effectiveTier(await getProfile(user.id));
  return NextResponse.json(
    { tier, signedIn: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
