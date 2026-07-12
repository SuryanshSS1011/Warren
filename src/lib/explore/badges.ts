// Explore badges (Phase 7): delightful achievements derived purely from a warren's shape —
// no new data, no infra. Pure functions over the stats + graph so they're trivially testable
// and can render live during a session or on a saved warren.

export type WarrenShape = {
  hops: number; // spine length - 1 (jumps taken)
  categories: number; // distinct categories touched
  nodes: number; // total articles in the graph
  minutes: number; // session length
  branches: number; // nodes explored off the main spine
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  /** emoji glyph for a lightweight, dependency-free icon */
  glyph: string;
};

// Each rule: does this warren earn the badge? Ordered roughly by how special it is.
const RULES: { badge: Badge; earned: (w: WarrenShape) => boolean }[] = [
  {
    badge: { id: "first-hop", name: "First Steps", description: "Took your first hop.", glyph: "🐾" },
    earned: (w) => w.hops >= 1,
  },
  {
    badge: { id: "deep-dive", name: "Deep Dive", description: "10+ hops in one journey.", glyph: "🌊" },
    earned: (w) => w.hops >= 10,
  },
  {
    badge: { id: "spelunker", name: "Spelunker", description: "25+ hops — a true rabbit hole.", glyph: "🔦" },
    earned: (w) => w.hops >= 25,
  },
  {
    badge: { id: "polymath", name: "Polymath", description: "Touched 5+ different fields.", glyph: "🧭" },
    earned: (w) => w.categories >= 5,
  },
  {
    badge: { id: "renaissance", name: "Renaissance", description: "10+ different fields in one warren.", glyph: "🎨" },
    earned: (w) => w.categories >= 10,
  },
  {
    badge: { id: "wanderer", name: "Wanderer", description: "Branched off the path 5+ times.", glyph: "🍃" },
    earned: (w) => w.branches >= 5,
  },
  {
    badge: { id: "marathoner", name: "Marathoner", description: "Explored for 20+ minutes straight.", glyph: "⏳" },
    earned: (w) => w.minutes >= 20,
  },
  {
    badge: { id: "cartographer", name: "Cartographer", description: "Mapped 30+ articles.", glyph: "🗺️" },
    earned: (w) => w.nodes >= 30,
  },
];

/** All badges this warren has earned, in rule order. */
export function earnedBadges(w: WarrenShape): Badge[] {
  return RULES.filter((r) => r.earned(w)).map((r) => r.badge);
}

/** Every badge, flagged earned/unearned — for a "collection" view showing what's left. */
export function allBadges(w: WarrenShape): (Badge & { earned: boolean })[] {
  return RULES.map((r) => ({ ...r.badge, earned: r.earned(w) }));
}
