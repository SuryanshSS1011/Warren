import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { isTier, type Tier } from "./tiers";

export type Profile = {
  id: string;
  tier: Tier;
  trialEndsAt: number | null; // ms epoch, or null
  lsCustomerId: string | null;
  lsSubscriptionId: string | null;
  lsStatus: string | null;
};

function rowToProfile(r: {
  id: string;
  tier: string;
  trial_ends_at: string | null;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  ls_status: string | null;
}): Profile {
  return {
    id: r.id,
    tier: isTier(r.tier) ? r.tier : "free",
    trialEndsAt: r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : null,
    lsCustomerId: r.ls_customer_id,
    lsSubscriptionId: r.ls_subscription_id,
    lsStatus: r.ls_status,
  };
}

/** Fetch a user's profile, or null when unconfigured / not found. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const db = getAdminClient();
  if (!db || !userId) return null;
  const { data, error } = await db
    .from("profile")
    .select("id, tier, trial_ends_at, ls_customer_id, ls_subscription_id, ls_status")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data);
}

/**
 * Ensure a profile row exists for a user; on first creation start the reverse trial (full Pro
 * for `trialDays`). Idempotent — never resets an existing profile's trial or tier. Returns the
 * profile, or null when persistence is unconfigured.
 */
export async function ensureProfile(
  userId: string,
  opts: { trialDays?: number; now?: number } = {},
): Promise<Profile | null> {
  const db = getAdminClient();
  if (!db || !userId) return null;

  const existing = await getProfile(userId);
  if (existing) return existing;

  const trialDays = opts.trialDays ?? 14;
  const now = opts.now ?? Date.now();
  const trialEnds = new Date(now + trialDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("profile")
    .insert({ id: userId, tier: "free", trial_ends_at: trialEnds })
    .select("id, tier, trial_ends_at, ls_customer_id, ls_subscription_id, ls_status")
    .maybeSingle();
  // A concurrent insert may have won the race (unique PK) — fall back to a read.
  if (error || !data) return getProfile(userId);
  return rowToProfile(data);
}

/** Set a profile's tier + LS linkage from a billing webhook. Upserts the row. */
export async function setProfileBilling(
  userId: string,
  patch: Partial<{
    tier: Tier;
    lsCustomerId: string;
    lsSubscriptionId: string;
    lsStatus: string;
  }>,
): Promise<void> {
  const db = getAdminClient();
  if (!db || !userId) return;
  const row: Record<string, unknown> = { id: userId, updated_at: new Date().toISOString() };
  if (patch.tier !== undefined) row.tier = patch.tier;
  if (patch.lsCustomerId !== undefined) row.ls_customer_id = patch.lsCustomerId;
  if (patch.lsSubscriptionId !== undefined) row.ls_subscription_id = patch.lsSubscriptionId;
  if (patch.lsStatus !== undefined) row.ls_status = patch.lsStatus;
  const { error } = await db.from("profile").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`set profile billing: ${error.message}`);
}
