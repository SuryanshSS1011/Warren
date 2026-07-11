import { describe, it, expect } from "vitest";
import { tierAllows, TIER_RANK, isTier, FEATURE_MIN_TIER } from "./tiers";

describe("tier ranking", () => {
  it("orders free < pro < researcher", () => {
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.pro);
    expect(TIER_RANK.pro).toBeLessThan(TIER_RANK.researcher);
  });

  it("isTier guards known tiers", () => {
    expect(isTier("pro")).toBe(true);
    expect(isTier("enterprise")).toBe(false);
  });
});

describe("tierAllows (feature gating)", () => {
  it("free cannot use a Pro feature", () => {
    expect(tierAllows("free", "tts")).toBe(false);
    expect(tierAllows("free", "export")).toBe(false);
  });

  it("pro can use Pro features but not Researcher features", () => {
    expect(tierAllows("pro", "tts")).toBe(true);
    expect(tierAllows("pro", "grounded_chat")).toBe(true);
    expect(tierAllows("pro", "citation_explorer")).toBe(false);
    expect(tierAllows("pro", "api_access")).toBe(false);
  });

  it("researcher can use everything gated", () => {
    for (const f of Object.keys(FEATURE_MIN_TIER) as (keyof typeof FEATURE_MIN_TIER)[]) {
      expect(tierAllows("researcher", f)).toBe(true);
    }
  });
});
