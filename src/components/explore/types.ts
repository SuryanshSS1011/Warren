import type { CategoryName } from "@/lib/explore/corpus";

/** A node as the graph renders it — derived from the live warren state. */
export type GraphNode = {
  id: string;
  depth: number;
  category: CategoryName;
  title: string;
};

/** A directed edge between two present nodes. */
export type GraphEdge = {
  source: string;
  target: string;
  spine: boolean;
  bridge: string;
};

/** Imperative camera API the ForceGraph hands back to the orchestrator. */
export type GraphApi = {
  fitToView: () => void;
  focus: (id: string) => void;
};
