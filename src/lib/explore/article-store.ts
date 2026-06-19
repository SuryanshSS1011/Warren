// A client-side store for the live Wikipedia articles a session has touched. Every node in
// the Explore graph is a live Wikipedia article, referenced by a "live:" + title id
// ("live:Gravity well"). There is no offline corpus: titles, summaries, categories,
// thumbnails, and links all come from Wikipedia at runtime (see lib/wikipedia/client.ts).

import { UNCATEGORIZED } from "./hue";

export type ResolvedArticle = {
  id: string;
  title: string;
  /** a live Wikipedia category string (hashed to a hue) */
  category: string;
  blurb: string;
  extract: string;
  /** ids of articles you can burrow into (live: ids) */
  links: string[];
  imgHint: string;
  thumbnail?: string;
  source: "live";
  /** the canonical Wikipedia title to fetch summary/links with */
  wikiTitle: string;
};

const LIVE_PREFIX = "live:";

export const isLiveId = (id: string) => id.startsWith(LIVE_PREFIX);

/** Stable id for a live Wikipedia article from its title. */
export const liveIdFor = (title: string) => `${LIVE_PREFIX}${title}`;

/** The Wikipedia title an id maps to (strips the live: prefix; ids are always live now). */
export function wikiTitleFor(id: string): string {
  return isLiveId(id) ? id.slice(LIVE_PREFIX.length) : id;
}

// Live articles fetched this session, keyed by their live: id. Module-level so it persists
// across renders without re-fetching; the component drives writes via upsertLive().
const liveCache = new Map<string, ResolvedArticle>();

export function upsertLive(article: {
  title: string;
  category?: string;
  extract?: string;
  description?: string;
  thumbnail?: string;
  links?: string[];
}): ResolvedArticle {
  const id = liveIdFor(article.title);
  const existing = liveCache.get(id);
  const resolved: ResolvedArticle = {
    id,
    title: article.title,
    category: article.category ?? existing?.category ?? UNCATEGORIZED,
    blurb: article.description ?? existing?.blurb ?? "",
    extract: article.extract ?? existing?.extract ?? "",
    links: article.links ?? existing?.links ?? [],
    imgHint: `Wikipedia · ${article.title}`,
    thumbnail: article.thumbnail ?? existing?.thumbnail,
    source: "live",
    wikiTitle: article.title,
  };
  liveCache.set(id, resolved);
  return resolved;
}

/** Resolve a live id to a unified article, if we've fetched it this session. */
export function resolve(id: string): ResolvedArticle | undefined {
  return liveCache.get(id);
}

/** A lightweight placeholder for a live id we haven't fetched yet (so a freshly-spawned
    node can render its title immediately while the summary loads). */
export function placeholder(id: string): ResolvedArticle {
  const known = resolve(id);
  if (known) return known;
  const title = wikiTitleFor(id);
  return {
    id,
    title,
    category: UNCATEGORIZED,
    blurb: "",
    extract: "",
    links: [],
    imgHint: `Wikipedia · ${title}`,
    source: "live",
    wikiTitle: title,
  };
}
