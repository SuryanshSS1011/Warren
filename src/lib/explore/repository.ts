// Server-side warren persistence. Save/load a warren snapshot to Supabase. Uses the
// service-role admin client so anonymous-author warrens work; when Supabase isn't
// configured (placeholder keys), save throws a clear error and load returns null.
import "server-only";
import { cache } from "react";
import { getAdminClient } from "@/lib/supabase/admin";
import { UNCATEGORIZED } from "./hue";
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
  existingId?: string,
): Promise<{ id: string }> {
  const db = getAdminClient();
  if (!db) throw new PersistenceUnavailableError();

  // Upsert path: when autosave passes an existing id (owned by this anon), update that row
  // and replace its graph in place — so "every session is a warren" without spawning a new
  // row per hop. The ON DELETE CASCADE clears the old node/edge rows before we re-insert.
  let warrenId: string;
  if (existingId) {
    const { data: owned } = await db
      .from("warren")
      .select("id")
      .eq("id", existingId)
      .eq("anon_id", anonId)
      .maybeSingle();
    if (!owned) {
      // not ours (or gone) — fall through to a fresh insert
      return saveWarren(snapshot, anonId);
    }
    warrenId = existingId;
    const { error: uErr } = await db
      .from("warren")
      .update({
        title: snapshot.title,
        spine: snapshot.spine,
        stats: snapshot.stats,
      })
      .eq("id", warrenId);
    if (uErr) throw new Error(`update warren: ${uErr.message}`);
    // clear the old graph; re-inserted below
    await db.from("edge").delete().eq("warren_id", warrenId);
    await db.from("node").delete().eq("warren_id", warrenId);
  } else {
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
    warrenId = warren.id as string;
  }

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

  // Compensating delete: if children fail after a FRESH insert, roll back the warren so we
  // never persist an orphan/empty graph (the ON DELETE CASCADE also clears any node/edge
  // rows that did insert). On the upsert path we keep the pre-existing row rather than
  // destroy a real session. Supabase has no client-side transaction.
  if (nErr || eErr) {
    if (!existingId) await db.from("warren").delete().eq("id", warrenId);
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
      category: n.category ?? UNCATEGORIZED,
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
      category: n.category ?? UNCATEGORIZED,
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

// ---- Super Warren: the meta-graph of how sessions connect ----

/** A warren as a node in the Super Warren meta-graph. */
export type SuperNode = {
  id: string;
  title: string;
  /** the warren's dominant field (most common node category) — drives the meta-node hue */
  field: string;
  /** number of articles in the warren */
  size: number;
  trail: { title: string; category: string }[];
};

/** A link between two warrens that share one or more articles. */
export type SuperLink = {
  source: string;
  target: string;
  /** number of articles the two warrens have in common */
  shared: number;
  /** a few shared article titles, for the tooltip/preview */
  sharedTitles: string[];
};

export type SuperWarren = { warrens: SuperNode[]; links: SuperLink[] };

/**
 * Build the Super Warren meta-graph: every public warren is a node, and two warrens are
 * linked when they SHARE one or more articles (matched by article title, which is stable
 * across sessions — node ids are "live:Title"). Link weight = number of shared articles.
 * Computed entirely from existing warren/node rows — no schema change. [] without Supabase.
 */
export async function loadSuperWarren(limit = 60): Promise<SuperWarren> {
  const db = getAdminClient();
  if (!db) return { warrens: [], links: [] };

  const { data: warrens, error } = await db
    .from("warren")
    .select("id, title, spine, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !warrens?.length) return { warrens: [], links: [] };

  const ids = warrens.map((w) => w.id);
  const { data: nodes } = await db
    .from("node")
    .select("warren_id, id, title, category")
    .in("warren_id", ids);

  // group nodes by warren, and build a title → set-of-warrens inverted index for overlap.
  const byWarren = new Map<string, { title: string; category: string }[]>();
  const warrensByTitle = new Map<string, Set<string>>();
  for (const n of nodes ?? []) {
    const wId = n.warren_id as string;
    const title = n.title as string;
    const category = (n.category as string) ?? UNCATEGORIZED;
    if (!byWarren.has(wId)) byWarren.set(wId, []);
    byWarren.get(wId)!.push({ title, category });
    if (!warrensByTitle.has(title)) warrensByTitle.set(title, new Set());
    warrensByTitle.get(title)!.add(wId);
  }

  // dominant field per warren = most common category among its nodes
  const dominantField = (ns: { category: string }[]): string => {
    const counts = new Map<string, number>();
    for (const n of ns) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    let best = UNCATEGORIZED;
    let bestN = -1;
    for (const [cat, c] of counts) {
      if (c > bestN) {
        best = cat;
        bestN = c;
      }
    }
    return best;
  };

  const superNodes: SuperNode[] = warrens.map((w) => {
    const ns = byWarren.get(w.id) ?? [];
    const spine = (w.spine ?? []) as string[];
    const nodeBy = new Map(ns.map((n) => [n.title, n]));
    // trail: spine titles in order (ids are live: titles → strip the prefix to match)
    const trail = spine
      .map((id) => {
        const t = id.startsWith("live:") ? id.slice(5) : id;
        return nodeBy.get(t) ?? ns.find((n) => n.title === t);
      })
      .filter(Boolean) as { title: string; category: string }[];
    return {
      id: w.id,
      title: w.title ?? "Untitled warren",
      field: dominantField(ns),
      size: ns.length,
      trail: trail.length ? trail : ns.slice(0, 6),
    };
  });

  // emit one weighted link per pair of warrens that share ≥1 article title.
  const pairShared = new Map<string, { shared: number; titles: string[] }>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const [title, set] of warrensByTitle) {
    if (set.size < 2) continue;
    const arr = [...set];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const key = pairKey(arr[i], arr[j]);
        const cur = pairShared.get(key) ?? { shared: 0, titles: [] };
        cur.shared += 1;
        if (cur.titles.length < 4) cur.titles.push(title);
        pairShared.set(key, cur);
      }
  }
  const links: SuperLink[] = [...pairShared.entries()].map(([key, v]) => {
    const [source, target] = key.split("|");
    return { source, target, shared: v.shared, sharedTitles: v.titles };
  });

  return { warrens: superNodes, links };
}
