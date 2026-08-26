import "server-only";
import { getUser } from "@/lib/supabase/auth";
import { getProfile, type Profile } from "./profile";
import { tierAllows, type Feature, type Tier } from "./tiers";

/**
 * The tier a profile is effectively entitled to RIGHT NOW. A reverse trial (trial_ends_at in
 * the future) grants Pro regardless of the stored tier; once it expires, the stored `tier`
 * (which the billing webhook maintains) applies. Anonymous / profile-less users are `free`.
 */
export function effectiveTier(profile: Profile | null, now: number = Date.now()): Tier {
  if (!profile) return "free";
  const onTrial = profile.trialEndsAt != null && profile.trialEndsAt > now;
  // Trial grants Pro, but never downgrades someone already on a higher paid tier.
  if (onTrial && profile.tier === "free") return "pro";
  return profile.tier;
}

/**
 * Server-side entitlement check. NEVER trust the client for this — call it in route handlers
 * / server components before doing gated work. Returns false for anonymous users on any gated
 * feature (they're `free`).
 */
export async function can(feature: Feature): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const profile = await getProfile(user.id);
  return tierAllows(effectiveTier(profile), feature);
}

/** The current viewer's effective tier (free for anonymous). Handy for UI + quota logic. */
export async function currentTier(): Promise<Tier> {
  const user = await getUser();
  if (!user) return "free";
  return effectiveTier(await getProfile(user.id));
}

/** Display-ready tier + reverse-trial state for a profile (keeps Date.now out of render). */
export function tierDisplay(
  profile: Profile | null,
  now: number = Date.now(),
): { tier: Tier; onTrial: boolean; trialDaysLeft: number } {
  const tier = effectiveTier(profile, now);
  const onTrial =
    tier === "pro" && profile?.tier === "free" && (profile?.trialEndsAt ?? 0) > now;
  const trialDaysLeft = onTrial
    ? Math.ceil(((profile?.trialEndsAt ?? now) - now) / (24 * 60 * 60 * 1000))
    : 0;
  return { tier, onTrial, trialDaysLeft };
}
