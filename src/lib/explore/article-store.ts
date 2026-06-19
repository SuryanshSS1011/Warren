// A unified, client-side article model that merges the offline corpus with live Wikipedia
// articles fetched at runtime. The Explore graph references articles by a single `id`:
//   - corpus articles keep their slug id ("black-hole")
//   - live Wikipedia articles use a "live:" + title id ("live:Gravity well")
// This resolves the corpus-slug ↔ Wikipedia-title mismatch without special-casing the
// graph: every node has an id, a title, a category, an extract, and a list of link ids.

import {
  type Article,
  type CategoryName,
  byId as corpusById,
} from "./corpus";

export type ResolvedArticle = {
  id: string;
  title: string;
  category: CategoryName;
  blurb: string;
  extract: string;
  /** ids of articles you can burrow into (corpus slugs and/or live: ids) */
  links: string[];
  imgHint: string;
  thumbnail?: string;
  source: "corpus" | "live";
  /** the canonical Wikipedia title to fetch summary/links with */
  wikiTitle: string;
};

const LIVE_PREFIX = "live:";

export const isLiveId = (id: string) => id.startsWith(LIVE_PREFIX);

/** Stable id for a live Wikipedia article from its title. */
export const liveIdFor = (title: string) => `${LIVE_PREFIX}${title}`;

/** The Wikipedia title an id maps to (corpus title for slugs, the bare title for live). */
export function wikiTitleFor(id: string): string {
  if (isLiveId(id)) return id.slice(LIVE_PREFIX.length);
  return corpusById[id]?.title ?? id;
}

// Live articles fetched this session, keyed by their live: id. Module-level so it persists
// across renders without re-fetching; the component drives writes via upsertLive().
const liveCache = new Map<string, ResolvedArticle>();

/** Wikipedia has no clean category signal in the summary; default live nodes to a neutral
    hue. (A future pass could derive this from Wikidata "instance of".) */
const DEFAULT_LIVE_CATEGORY: CategoryName = "Physics";

export function upsertLive(article: {
  title: string;
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
    category: existing?.category ?? DEFAULT_LIVE_CATEGORY,
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

function fromCorpus(a: Article): ResolvedArticle {
  return {
    id: a.id,
    title: a.title,
    category: a.category,
    blurb: a.blurb,
    extract: a.extract,
    links: a.links,
    imgHint: a.imgHint,
    source: "corpus",
    wikiTitle: a.title,
  };
}

/** Resolve any id (corpus slug or live: id) to a unified article, if known. */
export function resolve(id: string): ResolvedArticle | undefined {
  if (isLiveId(id)) return liveCache.get(id);
  const a = corpusById[id];
  return a ? fromCorpus(a) : undefined;
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
    category: DEFAULT_LIVE_CATEGORY,
    blurb: "",
    extract: "",
    links: [],
    imgHint: `Wikipedia · ${title}`,
    source: "live",
    wikiTitle: title,
  };
}
