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

  const [{ error: nErr }, { error: eErr }] = await Promise.all([
    db.from("node").insert(nodeRows),
    edgeRows.length ? db.from("edge").insert(edgeRows) : Promise.resolve({ error: null }),
  ]);
  if (nErr) throw new Error(`save nodes: ${nErr.message}`);
  if (eErr) throw new Error(`save edges: ${eErr.message}`);

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
