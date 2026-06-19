/** A node as the graph renders it — derived from the live warren state. The category is a
    string: a corpus enum value OR a live Wikipedia category (both hashed to a hue). */
export type GraphNode = {
  id: string;
  depth: number;
  category: string;
  title: string;
};

/** A directed edge between two present nodes. */
export type GraphEdge = {
  source: string;
  target: string;
  spine: boolean;
  bridge: string;
};

/** Imperative camera API the graph engine hands back to the orchestrator. */
export type GraphApi = {
  fitToView: () => void;
  focus: (id: string) => void;
};

/**
 * THE GRAPH ENGINE SEAM.
 *
 * This is the single contract every graph render-engine must satisfy. Today it's the
 * hand-rolled DOM-tile `ForceGraph`; a future canvas engine (react-force-graph-2d, for
 * 500+ node scale — see the migration task) must implement the SAME props + `onReady`
 * GraphApi so it drops in without touching ExploreMap, BurrowCard, ReplayMap, or gallery.
 *
 * Keep ExploreMap talking to the engine ONLY through this interface.
 */
export type GraphEngineProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  spineIds: string[];
  newestId: string | null;
  accent: string;
  /** force every node's title label on (otherwise only spine/selected/hovered show) */
  showAllLabels: boolean;
  /** dim non-spine context nodes (e.g. while a burrow card is open) */
  dimmed: boolean;
  /** px to reserve on the right so the camera never frames behind the burrow card */
  reserveRight: number;
  /** px to reserve at the bottom for the mobile burrow bottom-sheet */
  reserveBottom: number;
  /** px to reserve at the top for the mobile HUD band (brand + controls + stats) */
  reserveTop: number;
  onSelect: (id: string) => void;
  onReady: (api: GraphApi) => void;
};

/**
 * Level-of-detail thresholds by node count. As warrens grow, the DOM-tile renderer
 * progressively simplifies to stay performant; this is also the signal that tells us
 * when to switch to the canvas engine. Tune from real measurements.
 */
export const LOD = {
  /** above this, only spine/selected nodes show full tiles; others collapse to dots */
  SIMPLIFY_TILES_AT: 60,
  /** above this, hide all non-spine labels regardless of showAllLabels */
  FORCE_HIDE_LABELS_AT: 120,
  /** above this, DOM tiles are past their comfort zone — prefer the canvas engine */
  CANVAS_RECOMMENDED_AT: 200,
} as const;

/** Per-node render detail the engine should use, given the total node count. */
export function detailFor(
  nodeCount: number,
  opts: { onSpine: boolean; isSelected: boolean },
): "tile" | "dot" {
  if (opts.onSpine || opts.isSelected) return "tile";
  return nodeCount > LOD.SIMPLIFY_TILES_AT ? "dot" : "tile";
}
