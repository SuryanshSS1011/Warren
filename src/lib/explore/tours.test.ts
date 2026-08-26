import { describe, it, expect } from "vitest";
import { TOURS, getTour } from "./tours";

describe("TOURS data integrity", () => {
  it("has tours, each well-formed", () => {
    expect(TOURS.length).toBeGreaterThan(0);
    for (const t of TOURS) {
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(t.title).toBeTruthy();
      expect(t.blurb).toBeTruthy();
      expect(t.glyph).toBeTruthy();
      expect(t.path.length).toBeGreaterThanOrEqual(3); // a tour is a real journey
      for (const step of t.path) expect(step).toBeTruthy();
    }
  });

  it("has unique slugs", () => {
    const slugs = TOURS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("getTour", () => {
  it("finds a tour by slug", () => {
    const first = TOURS[0];
    expect(getTour(first.slug)).toEqual(first);
  });
  it("returns undefined for an unknown slug", () => {
    expect(getTour("nope")).toBeUndefined();
  });
});
