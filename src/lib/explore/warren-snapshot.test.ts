import { describe, it, expect } from "vitest";
import { WarrenSnapshot, SnapshotEdge } from "./warren-snapshot";

const valid = {
  title: "The Black Hole to Jazz Run",
  spine: ["n1", "n2"],
  nodes: [
    { id: "n1", title: "Black hole", category: "Physics", depth: 0 },
    { id: "n2", title: "Jazz", category: "Music", depth: 1 },
  ],
  edges: [{ source: "n1", target: "n2", spine: true, bridge: "a leap" }],
  startedAt: 1_700_000_000_000,
  stats: { hops: 1, categories: 2, minutes: 3, stars: 4 },
};

describe("WarrenSnapshot schema", () => {
  it("accepts a well-formed snapshot", () => {
    expect(WarrenSnapshot.safeParse(valid).success).toBe(true);
  });

  it("requires a non-empty spine", () => {
    expect(WarrenSnapshot.safeParse({ ...valid, spine: [] }).success).toBe(false);
  });

  it("requires at least one node", () => {
    expect(WarrenSnapshot.safeParse({ ...valid, nodes: [] }).success).toBe(false);
  });

  it("bounds stars to 1..5", () => {
    expect(
      WarrenSnapshot.safeParse({ ...valid, stats: { ...valid.stats, stars: 6 } }).success,
    ).toBe(false);
    expect(
      WarrenSnapshot.safeParse({ ...valid, stats: { ...valid.stats, stars: 0 } }).success,
    ).toBe(false);
  });

  it("rejects negative depth", () => {
    const bad = { ...valid, nodes: [{ ...valid.nodes[0], depth: -1 }, valid.nodes[1]] };
    expect(WarrenSnapshot.safeParse(bad).success).toBe(false);
  });
});

describe("SnapshotEdge", () => {
  it("defaults bridge to an empty string when omitted", () => {
    const parsed = SnapshotEdge.parse({ source: "a", target: "b", spine: false });
    expect(parsed.bridge).toBe("");
  });
});
