// The serializable shape of a saved warren — what the Save action sends, what the
// view/replay page and OG image read. Kept framework-agnostic (no React/DOM) so it can
// be used on the server (persistence, OG render) and the client (save, replay).
import { z } from "zod";

export const SnapshotNode = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  depth: z.number().int().min(0),
});

export const SnapshotEdge = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  spine: z.boolean(),
  bridge: z.string().default(""),
});

export const WarrenSnapshot = z.object({
  title: z.string().min(1),
  // spine = the user's actual clicked path, in order (ids referencing nodes)
  spine: z.array(z.string().min(1)).min(1),
  nodes: z.array(SnapshotNode).min(1),
  edges: z.array(SnapshotEdge),
  startedAt: z.number().int(),
  // denormalized stats (also derivable) for cheap OG rendering
  stats: z.object({
    hops: z.number().int().min(0),
    categories: z.number().int().min(0),
    minutes: z.number().int().min(0),
    stars: z.number().int().min(1).max(5),
  }),
});

export type SnapshotNode = z.infer<typeof SnapshotNode>;
export type SnapshotEdge = z.infer<typeof SnapshotEdge>;
export type WarrenSnapshot = z.infer<typeof WarrenSnapshot>;

export type SavedWarren = WarrenSnapshot & { id: string };
