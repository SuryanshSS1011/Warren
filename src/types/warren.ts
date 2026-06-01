export type WarrenNodeId = string;

export type WarrenNode = {
  id: WarrenNodeId;
  title: string;
  description?: string;
  thumbnail?: string;
  category?: string;
  // depth from the start article (encoded as node size in the map)
  depth: number;
  // ms since the node was created (encoded as opacity/brightness)
  createdAt: number;
  // ms the user dwelled reading this node (encoded as halo thickness)
  dwellMs?: number;
};

export type WarrenEdge = {
  source: WarrenNodeId;
  target: WarrenNodeId;
  // The AI-generated one-sentence bridge from source to target.
  bridge?: string;
  // True if this edge is part of the user's clicked path (the "spine").
  spine: boolean;
};

export type Warren = {
  id: string;
  title?: string;
  nodes: WarrenNode[];
  edges: WarrenEdge[];
  startedAt: number;
};
