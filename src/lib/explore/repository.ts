// Server-side warren persistence. Save/load a warren snapshot to Supabase. Uses the
// service-role admin client so anonymous-author warrens work; when Supabase isn't
// configured (placeholder keys), save throws a clear error and load returns null.
import "server-only";
import { cache } from "react";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  type SavedWarren,
  type WarrenSnapshot,
} from "./warren-snapshot";

export class PersistenceUnavailableError extends Error {
  constructor() {
    super("Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
    this.name = "PersistenceUnavailableError";
  }
}

export async function saveWarren(
  snapshot: WarrenSnapshot,
  anonId: string,
): Promise<{ id: string }> {
  const db = getAdminClient();
  if (!db) throw new PersistenceUnavailableError();

  const { data: warren, error: wErr } = await db
    .from("warren")
    .insert({
      anon_id: anonId,
      title: snapshot.title,
      spine: snapshot.spine,
      started_at: new Date(snapshot.startedAt).toISOString(),
      is_public: true,
      stats: snapshot.stats,
    })
    .select("id")
    .single();
  if (wErr || !warren) throw new Error(`save warren: ${wErr?.message ?? "no row"}`);

  const warrenId = warren.id as string;

  const nodeRows = snapshot.nodes.map((n) => ({
    warren_id: warrenId,
    id: n.id,
    title: n.title,
    category: n.category,
    depth: n.depth,
  }));
  const edgeRows = snapshot.edges.map((e) => ({
    warren_id: warrenId,
    source: e.source,
    target: e.target,
    bridge: e.bridge,
    spine: e.spine,
  }));

  // Insert nodes BEFORE edges: the edge composite FKs require both endpoints to already
  // exist as nodes in the same warren.
  const { error: nErr } = await db.from("node").insert(nodeRows);
  const { error: eErr } = nErr
    ? { error: null }
    : edgeRows.length
      ? await db.from("edge").insert(edgeRows)
      : { error: null };

  // Compensating delete: if children fail after the parent row landed, roll back the
  // warren so we never persist an orphan/empty graph (the ON DELETE CASCADE also clears
  // any node/edge rows that did insert). Supabase has no client-side transaction.
  if (nErr || eErr) {
    await db.from("warren").delete().eq("id", warrenId);
    throw new Error(`save graph: ${(nErr ?? eErr)!.message}`);
  }

  return { id: warrenId };
}

// React.cache dedupes the fetch across generateMetadata + page + opengraph-image.
export const loadWarren = cache(async (id: string): Promise<SavedWarren | null> => {
  const db = getAdminClient();
  if (!db) return null;

  const { data: w, error } = await db
    .from("warren")
    .select("id, title, spine, started_at, stats, is_public")
    .eq("id", id)
    .maybeSingle();
  if (error || !w || !w.is_public) return null;

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    db.from("node").select("id, title, category, depth").eq("warren_id", id),
    db.from("edge").select("source, target, bridge, spine").eq("warren_id", id),
  ]);

  return {
    id: w.id,
    title: w.title ?? "Untitled warren",
    spine: (w.spine ?? []) as string[],
    startedAt: new Date(w.started_at).getTime(),
    stats: w.stats ?? { hops: 0, categories: 0, minutes: 0, stars: 1 },
    nodes: (nodes ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category ?? "Physics",
      depth: n.depth ?? 0,
    })),
    edges: (edges ?? []).map((e) => ({
      source: e.source,
      target: e.target,
      bridge: e.bridge ?? "",
      spine: !!e.spine,
    })),
  };
});

/** A lightweight gallery row — enough to render a mini-trail thumbnail + stats card. */
export type WarrenCard = {
  id: string;
  title: string;
  stats: { hops: number; categories: number; minutes: number; stars: number };
  createdAt: number;
  /** ordered category per spine node, for the mini-trail colors */
  trail: { title: string; category: string }[];
};

/** Public warrens for the gallery, newest first. Returns [] without Supabase. */
export async function listPublicWarrens(limit = 24): Promise<WarrenCard[]> {
  const db = getAdminClient();
  if (!db) return [];

  const { data: warrens, error } = await db
    .from("warren")
    .select("id, title, spine, stats, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !warrens?.length) return [];

  // One batched node fetch for all warrens, then map spine ids → {title, category}.
  const ids = warrens.map((w) => w.id);
  const { data: nodes } = await db
    .from("node")
    .select("warren_id, id, title, category")
    .in("warren_id", ids);

  const nodeBy = new Map<string, { title: string; category: string }>();
  for (const n of nodes ?? []) {
    nodeBy.set(`${n.warren_id}:${n.id}`, {
      title: n.title,
      category: n.category ?? "Physics",
    });
  }

  return warrens.map((w) => ({
    id: w.id,
    title: w.title ?? "Untitled warren",
    stats: w.stats ?? { hops: 0, categories: 0, minutes: 0, stars: 1 },
    createdAt: new Date(w.created_at).getTime(),
    trail: ((w.spine ?? []) as string[])
      .map((nid) => nodeBy.get(`${w.id}:${nid}`))
      .filter(Boolean) as { title: string; category: string }[],
  }));
}

/** Search public warrens by title (case-insensitive fuzzy match). */
export async function searchPublicWarrens(query: string, limit = 24): Promise<WarrenCard[]> {
  const db = getAdminClient();
  if (!db || !query.trim()) return [];

  const { data: warrens, error } = await db
    .from("warren")
    .select("id, title, spine, stats, created_at")
    .eq("is_public", true)
    .ilike("title", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !warrens?.length) return [];

  const ids = warrens.map((w) => w.id);
  const { data: nodes } = await db
    .from("node")
    .select("warren_id, id, title, category")
    .in("warren_id", ids);

  const nodeBy = new Map<string, { title: string; category: string }>();
  for (const n of nodes ?? []) {
    nodeBy.set(`${n.warren_id}:${n.id}`, {
      title: n.title,
      category: n.category ?? "Physics",
    });
  }

  return warrens.map((w) => ({
    id: w.id,
    title: w.title ?? "Untitled warren",
    stats: w.stats ?? { hops: 0, categories: 0, minutes: 0, stars: 1 },
    createdAt: new Date(w.created_at).getTime(),
    trail: ((w.spine ?? []) as string[])
      .map((nid) => nodeBy.get(`${w.id}:${nid}`))
      .filter(Boolean) as { title: string; category: string }[],
  }));
}
