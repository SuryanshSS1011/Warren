import { describe, it, expect } from "vitest";
import { hueFromString, hueOf, labelOf, UNCATEGORIZED, STARTER_TOPICS } from "./hue";

describe("hueFromString", () => {
  it("is deterministic — same string, same hue", () => {
    expect(hueFromString("Physics")).toBe(hueFromString("Physics"));
  });

  it("stays within [0, 360]", () => {
    for (const s of ["", "a", "Roman Empire", "🎷", "a".repeat(500)]) {
      const h = hueFromString(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(360);
    }
  });

  it("distinguishes different categories (not all collapsing to one hue)", () => {
    const hues = new Set(["Physics", "Biology", "History", "Music", "Geology"].map(hueFromString));
    expect(hues.size).toBeGreaterThan(1);
  });

  it("hueOf delegates to hueFromString", () => {
    expect(hueOf("Jazz")).toBe(hueFromString("Jazz"));
  });
});

describe("labelOf", () => {
  it("returns the category verbatim (no hardcoded taxonomy)", () => {
    expect(labelOf("Marine biology")).toBe("Marine biology");
  });
});

describe("constants", () => {
  it("has a neutral uncategorized placeholder", () => {
    expect(UNCATEGORIZED).toBe("Topic");
  });

  it("ships a non-empty list of plain starter topics", () => {
    expect(STARTER_TOPICS.length).toBeGreaterThan(0);
    for (const t of STARTER_TOPICS) expect(typeof t).toBe("string");
  });
});
