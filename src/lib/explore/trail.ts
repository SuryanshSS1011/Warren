// Geometry helpers for the "trail" motif used on the share card (and reusable for the
// replay/gallery thumbnails). Lays a sequence of nodes along a gentle snaking path inside
// a box and produces a smooth Catmull-Rom → cubic-bezier SVG path through them.
// Framework-agnostic (no DOM) so it runs inside the Satori/OG renderer.

export type TrailPoint = { x: number; y: number };

/** Smooth a polyline into a cubic-bezier path string. */
export function smoothPath(pts: TrailPoint[], k = 0.5): string {
  if (!pts.length) return "";
  if (pts.length < 3) return "M" + pts.map((p) => `${p.x} ${p.y}`).join(" L ");
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * k * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * k * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * k * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * k * 2;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Deterministically lay `count` points along a snaking trail across a box. */
export function layoutTrail(
  count: number,
  w: number,
  h: number,
  opts?: { padX?: number; padY?: number; amp?: number; seed?: number },
): TrailPoint[] {
  const padX = opts?.padX ?? w * 0.1;
  const padY = opts?.padY ?? h * 0.22;
  const amp = opts?.amp ?? h * 0.26;
  const seed = opts?.seed ?? 7;
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }).map((_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = padX + t * (w - padX * 2);
    const wave = Math.sin(t * Math.PI * 1.7 + seed) * amp;
    const jitter = (rnd() - 0.5) * amp * 0.5;
    const y = Math.max(padY, Math.min(h - padY, h / 2 + wave + jitter));
    return { x, y };
  });
}
