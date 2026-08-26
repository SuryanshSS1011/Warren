// Tiers and the feature→tier matrix (PRODUCT_PLAN §4). Vendor-neutral: nothing here knows
// about LemonSqueezy. The entitlement layer (entitlements.ts) reads this to answer can().

export type Tier = "free" | "pro" | "researcher";

export const TIERS: Tier[] = ["free", "pro", "researcher"];

/** Rank for "at least this tier" comparisons. Higher = more access. */
export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  pro: 1,
  researcher: 2,
};

export function isTier(v: string): v is Tier {
  return (TIERS as string[]).includes(v);
}

/**
 * Gateable features and the MINIMUM tier each requires. Free features aren't listed — the
 * absence of a feature here means it's available to everyone (free). Add a feature here only
 * when it should be gated. Keep names stable; they're used in can() call sites.
 */
export const FEATURE_MIN_TIER = {
  // --- Pro ($5) ---
  tts: "pro", // TTS narration
  reading_level: "pro", // ELI5↔expert reading-level rewrite
  grounded_chat: "pro", // "ask this article" grounded chat
  unlimited_saves: "pro", // beyond the free saved-warren cap
  spaced_repetition: "pro", // Learn: flashcards / SRS
  private_trails: "pro", // keep trails private (free tier is public-only)
  export: "pro", // export to Obsidian/Anki/etc.

  // --- Researcher ($12–15) ---
  citation_explorer: "researcher",
  watchlist_monitoring: "researcher",
  cross_lingual: "researcher",
  bulk_export: "researcher",
  api_access: "researcher",
  higher_quota: "researcher",
} as const satisfies Record<string, Tier>;

export type Feature = keyof typeof FEATURE_MIN_TIER;

export const FEATURES = Object.keys(FEATURE_MIN_TIER) as Feature[];

/** Does `tier` meet the minimum required for `feature`? */
export function tierAllows(tier: Tier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}
