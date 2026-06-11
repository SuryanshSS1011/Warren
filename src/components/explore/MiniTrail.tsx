import { hueOf } from "@/lib/explore/corpus";
import { layoutTrail, smoothPath } from "@/lib/explore/trail";

/** A small gold-trail thumbnail through a warren's spine nodes — the gallery-card
    motif, echoing the share card. Pure SVG, server-renderable. */
export default function MiniTrail({
  trail,
  width = 320,
  height = 150,
  accent = "#e9b44c",
}: {
  trail: { title: string; category: string }[];
  width?: number;
  height?: number;
  accent?: string;
}) {
  const count = Math.max(trail.length, 2);
  const pts = layoutTrail(count, width, height, {
    padX: width * 0.12,
    padY: height * 0.28,
    amp: height * 0.22,
    seed: 9,
  });
  const path = smoothPath(pts, 0.55);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={trail.map((t) => t.title).join(" → ")}
    >
      <path
        d={path}
        fill="none"
        stroke={accent}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.92}
      />
      {pts.map((p, i) => {
        const node = trail[i];
        const h = node ? hueOf(node.category) : 256;
        const color = `oklch(0.72 0.15 ${h})`;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5.5} fill="#0e0e1a" stroke={color} strokeWidth={2} />
            <circle cx={p.x} cy={p.y} r={2.2} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
