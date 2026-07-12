import { describe, it, expect } from "vitest";
import { earnedBadges, allBadges, type WarrenShape } from "./badges";

const shape = (over: Partial<WarrenShape> = {}): WarrenShape => ({
  hops: 0, categories: 0, nodes: 0, minutes: 0, branches: 0, ...over,
});

describe("earnedBadges", () => {
  it("gives nothing for an empty warren", () => {
    expect(earnedBadges(shape())).toEqual([]);
  });

  it("earns First Steps on the first hop", () => {
    expect(earnedBadges(shape({ hops: 1 })).map((b) => b.id)).toContain("first-hop");
  });

  it("earns cumulative hop badges at thresholds", () => {
    const ids = earnedBadges(shape({ hops: 25 })).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["first-hop", "deep-dive", "spelunker"]));
  });

  it("does not earn a threshold just below it", () => {
    expect(earnedBadges(shape({ hops: 9 })).map((b) => b.id)).not.toContain("deep-dive");
  });

  it("earns field-diversity badges from categories", () => {
    expect(earnedBadges(shape({ categories: 5 })).map((b) => b.id)).toContain("polymath");
    expect(earnedBadges(shape({ categories: 10 })).map((b) => b.id)).toContain("renaissance");
  });

  it("earns wanderer, marathoner, cartographer from their stats", () => {
    const ids = earnedBadges(shape({ branches: 5, minutes: 20, nodes: 30 })).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["wanderer", "marathoner", "cartographer"]));
  });

  it("stacks all applicable badges for a big warren", () => {
    const ids = earnedBadges(
      shape({ hops: 30, categories: 12, branches: 8, minutes: 45, nodes: 40 }),
    ).map((b) => b.id);
    expect(ids.length).toBeGreaterThanOrEqual(7);
  });
});

describe("allBadges", () => {
  it("returns every badge flagged earned/unearned", () => {
    const all = allBadges(shape({ hops: 1 }));
    expect(all.length).toBeGreaterThan(1);
    expect(all.find((b) => b.id === "first-hop")?.earned).toBe(true);
    expect(all.find((b) => b.id === "spelunker")?.earned).toBe(false);
    // Each badge has display fields.
    for (const b of all) {
      expect(b.name).toBeTruthy();
      expect(b.glyph).toBeTruthy();
      expect(b.description).toBeTruthy();
    }
  });
});
