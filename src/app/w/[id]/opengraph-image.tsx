import { ImageResponse } from "next/og";
import { loadWarren } from "@/lib/explore/repository";
import { hueOf } from "@/lib/explore/hue";
import { layoutTrail, smoothPath } from "@/lib/explore/trail";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A Warren — your Wikipedia journey, mapped";

const BG = "#08080f";
const GOLD = "#e9b44c";
const IVORY = "#f4efe3";
const MUTED = "#a8a2bc";

// Satori can't render oklch(), so approximate the in-app oklch node color with hsl() from
// the same hashed hue. One rule for every node — no category swatch table.
function catColor(hue: number): string {
  return `hsl(${hue}, 62%, 70%)`;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const warren = await loadWarren(id);

  // Sample up to 7 nodes along the spine for the trail.
  const spineNodes = (warren?.spine ?? [])
    .map((nid) => warren?.nodes.find((n) => n.id === nid))
    .filter(Boolean)
    .slice(0, 7) as { id: string; title: string; category: string }[];

  const title = warren?.title ?? "Map your curiosity";
  const stats = warren?.stats ?? { hops: 0, categories: 0, minutes: 0, stars: 0 };

  const W = 1200;
  const H = 630;
  const pts = layoutTrail(Math.max(spineNodes.length, 2), W - 120, 360, {
    padX: 90,
    amp: 120,
    seed: 11,
  }).map((p) => ({ x: p.x + 60, y: p.y + 150 }));
  const path = smoothPath(pts, 0.55);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `radial-gradient(900px 600px at 78% 8%, rgba(160,120,60,0.18), ${BG}), ${BG}`,
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* starfield specks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const x = (i * 197) % W;
          const y = (i * 313) % H;
          const r = (i % 3) * 0.7 + 0.6;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                background: IVORY,
                opacity: 0.12 + (i % 5) * 0.06,
              }}
            />
          );
        })}

        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "44px 56px 0" }}>
          <svg width={40} height={30} viewBox="0 0 36 28">
            <line x1={6} y1={21} x2={14} y2={8} stroke={IVORY} strokeWidth={1.6} />
            <line x1={14} y1={8} x2={24} y2={15} stroke={IVORY} strokeWidth={1.6} />
            <line x1={24} y1={15} x2={31} y2={6} stroke={IVORY} strokeWidth={1.6} />
            <circle cx={6} cy={21} r={2.6} fill={IVORY} />
            <circle cx={14} cy={8} r={3.2} fill={IVORY} />
            <circle cx={24} cy={15} r={2.6} fill={IVORY} />
            <circle cx={31} cy={6} r={3.6} fill={GOLD} />
          </svg>
          <div style={{ color: IVORY, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
            Warren
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginLeft: 6,
            }}
          >
            Map your curiosity
          </div>
        </div>

        {/* title */}
        <div
          style={{
            display: "flex",
            padding: "18px 56px 0",
            color: IVORY,
            fontSize: 60,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        {/* the trail */}
        <svg
          width={W}
          height={420}
          viewBox={`0 0 ${W} 420`}
          style={{ position: "absolute", left: 0, top: 150 }}
        >
          <path d={path} fill="none" stroke={GOLD} strokeWidth={4} strokeLinecap="round" opacity={0.95} />
          {pts.map((p, i) => {
            const node = spineNodes[i];
            const color = node ? catColor(hueOf(node.category)) : GOLD;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={9} fill={BG} stroke={color} strokeWidth={3} />
                <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
              </g>
            );
          })}
        </svg>

        {/* node labels along the trail */}
        {pts.map((p, i) => {
          const node = spineNodes[i];
          if (!node) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x - 70,
                top: 150 + p.y + (i % 2 === 0 ? -44 : 20),
                width: 140,
                display: "flex",
                justifyContent: "center",
                color: IVORY,
                fontSize: 16,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {node.title}
            </div>
          );
        })}

        {/* stat strip */}
        <div
          style={{
            position: "absolute",
            left: 56,
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: MUTED,
            fontSize: 20,
          }}
        >
          <span style={{ color: IVORY, fontWeight: 700 }}>{stats.hops}</span> hops
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: IVORY, fontWeight: 700 }}>{stats.categories}</span> fields
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ color: IVORY, fontWeight: 700 }}>{stats.minutes}</span> min
          <span style={{ opacity: 0.4 }}>·</span>
          deepest dive <span style={{ color: GOLD, fontWeight: 700 }}>{stats.stars}</span>
        </div>

        <div
          style={{
            position: "absolute",
            right: 56,
            bottom: 40,
            color: GOLD,
            fontSize: 18,
            display: "flex",
          }}
        >
          replay this warren →
        </div>
      </div>
    ),
    { ...size },
  );
}
