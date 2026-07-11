import { describe, it, expect } from "vitest";
import { smoothPath, layoutTrail } from "./trail";

describe("smoothPath", () => {
  it("returns empty string for no points", () => {
    expect(smoothPath([])).toBe("");
  });

  it("emits a line path for 1–2 points (no bezier)", () => {
    expect(smoothPath([{ x: 1, y: 2 }])).toBe("M1 2");
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe("M0 0 L 10 10");
  });

  it("emits cubic-bezier segments for 3+ points", () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 0 },
    ]);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d).toContain(" C ");
  });
});

describe("layoutTrail", () => {
  it("produces exactly `count` points", () => {
    expect(layoutTrail(5, 800, 400)).toHaveLength(5);
    expect(layoutTrail(1, 800, 400)).toHaveLength(1);
    expect(layoutTrail(0, 800, 400)).toHaveLength(0);
  });

  it("centers a single point horizontally", () => {
    const [p] = layoutTrail(1, 800, 400);
    // t=0.5 → x = padX + 0.5*(w - 2*padX) = w/2
    expect(p.x).toBeCloseTo(400, 5);
  });

  it("keeps points within vertical padding bounds", () => {
    const w = 800;
    const h = 400;
    const padY = h * 0.22;
    for (const p of layoutTrail(20, w, h)) {
      expect(p.y).toBeGreaterThanOrEqual(padY);
      expect(p.y).toBeLessThanOrEqual(h - padY);
    }
  });

  it("marches x monotonically left-to-right", () => {
    const pts = layoutTrail(10, 800, 400);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(layoutTrail(8, 800, 400, { seed: 42 })).toEqual(
      layoutTrail(8, 800, 400, { seed: 42 }),
    );
  });

  it("differs for different seeds", () => {
    expect(layoutTrail(8, 800, 400, { seed: 1 })).not.toEqual(
      layoutTrail(8, 800, 400, { seed: 2 }),
    );
  });
});
