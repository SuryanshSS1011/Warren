import { describe, it, expect } from "vitest";
import { bridgeFor, titleFor } from "./narration";

describe("bridgeFor", () => {
  it("is deterministic for the same id pair", () => {
    expect(bridgeFor("a", "b")).toBe(bridgeFor("a", "b"));
  });

  it("resolves ids to display titles via the resolver", () => {
    const titleOf = (id: string) => ({ a: "Jazz", b: "Volcano" })[id] ?? id;
    const s = bridgeFor("a", "b", titleOf);
    expect(s).toContain("Jazz");
    expect(s).toContain("Volcano");
  });

  it("returns empty string when either title is missing", () => {
    const titleOf = (id: string) => (id === "a" ? "Jazz" : "");
    expect(bridgeFor("a", "b", titleOf)).toBe("");
  });

  it("can produce different sentences for different pairs", () => {
    const variants = new Set(
      [
        ["a", "b"],
        ["c", "d"],
        ["e", "f"],
        ["g", "h"],
      ].map(([x, y]) => bridgeFor(x, y)),
    );
    expect(variants.size).toBeGreaterThan(1);
  });
});

describe("titleFor", () => {
  it("falls back for empty/single spine", () => {
    expect(titleFor([])).toBe("Untitled warren");
    expect(titleFor(["only"], () => "Only")).toBe("Only");
  });

  it("builds a first→last run title", () => {
    const titleOf = (id: string) => ({ x: "Black hole", z: "Jazz" })[id] ?? id;
    expect(titleFor(["x", "y", "z"], titleOf)).toBe("The Black hole to Jazz Run");
  });
});
