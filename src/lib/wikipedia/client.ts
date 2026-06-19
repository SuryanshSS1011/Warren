// Server-only Wikimedia REST client. Always route Wikipedia calls through this module
// so we control the User-Agent, concurrency, rate-limit backoff, and caching.
//
// Etiquette (BUILD_PLAN.md "Rate limits"): mandatory User-Agent with contact info,
// respond to 429 with Retry-After + exponential backoff, ≤3 concurrent requests, and
// cache aggressively keyed by title.
import "server-only";
import PQueue from "p-queue";
import { getServerEnv } from "@/lib/env/server";
import { cached } from "@/lib/cache/redis";

const REST_BASE = "https://en.wikipedia.org/api/rest_v1";
const ACTION_BASE = "https://en.wikipedia.org/w/api.php";

// Cap concurrent Wikimedia requests at 3 (their per-user limit etiquette).
const queue = new PQueue({ concurrency: 3 });

const SUMMARY_TTL = 60 * 60 * 24 * 7; // 7 days
const LINKS_TTL = 60 * 60 * 24 * 3; // 3 days

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/** Fetch through the queue, retrying on 429 (honoring Retry-After) and 5xx with backoff.
    `revalidate` is the per-call Next fetch-cache TTL (seconds); pass the right one per
    endpoint instead of inheriting a single hard-coded value. */
export async function wikiFetch(
  url: string,
  opts?: { revalidate?: number; init?: RequestInit },
): Promise<Response> {
  const { WIKIPEDIA_USER_AGENT } = getServerEnv();
  const init = opts?.init;
  const revalidate = opts?.revalidate ?? SUMMARY_TTL;
  const headers = {
    "User-Agent": WIKIPEDIA_USER_AGENT,
    "Api-User-Agent": WIKIPEDIA_USER_AGENT,
    "Accept-Encoding": "gzip",
    ...init?.headers,
  };

  const run = async (): Promise<Response> => {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(url, {
        ...init,
        headers,
        next: { revalidate },
      });
      if (res.status !== 429 && res.status < 500) return res;
      if (attempt === maxAttempts) return res;
      // 429 → honor Retry-After if present, else exponential backoff with jitter.
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(8000, 2 ** attempt * 250) + Math.random() * 200;
      // Drain/cancel the discarded response so undici doesn't leak the socket on retry.
      await res.body?.cancel().catch(() => {});
      await sleep(backoff);
    }
    // unreachable, but satisfies the type checker
    return fetch(url, { ...init, headers, next: { revalidate } });
  };

  const result = await queue.add(run);
  if (!result) throw new Error(`Wikipedia request failed: ${url}`);
  return result;
}

/** Cancel a response body we won't read, so undici frees the socket for keep-alive reuse. */
function discard(res: Response): void {
  void res.body?.cancel().catch(() => {});
}

export type PageSummary = {
  title: string;
  description?: string;
  extract: string;
  extract_html?: string;
  thumbnail?: { source: string; width: number; height: number };
  type: "standard" | "disambiguation" | "no-extract" | "redirect" | string;
  content_urls?: { desktop: { page: string } };
};

export async function getPageSummary(title: string): Promise<PageSummary | null> {
  return cached(`wiki:summary:${title}`, SUMMARY_TTL, async () => {
    const res = await wikiFetch(`${REST_BASE}/page/summary/${encodeURIComponent(title)}`);
    if (res.status === 404) {
      discard(res);
      return null;
    }
    if (!res.ok) {
      discard(res);
      throw new Error(`Wikipedia summary ${title}: ${res.status}`);
    }
    return (await res.json()) as PageSummary;
  });
}

export async function getRelated(title: string): Promise<{ pages: PageSummary[] }> {
  const res = await wikiFetch(`${REST_BASE}/page/related/${encodeURIComponent(title)}`);
  if (!res.ok) {
    discard(res);
    return { pages: [] };
  }
  return (await res.json()) as { pages: PageSummary[] };
}

export type BlueLink = { title: string };

/** Live Wikipedia title search (opensearch) for the command palette — lets a user jump to
    ANY article, not just the offline corpus. */
export async function searchWikipedia(query: string, limit = 10): Promise<string[]> {
  const params = new URLSearchParams({
    action: "opensearch",
    format: "json",
    search: query,
    limit: String(Math.min(limit, 20)),
    namespace: "0",
    origin: "*",
  });
  const res = await wikiFetch(`${ACTION_BASE}?${params.toString()}`, { revalidate: 60 * 60 });
  if (!res.ok) {
    discard(res);
    return [];
  }
  const data = (await res.json()) as [string, string[], string[], string[]];
  return data[1] ?? [];
}

const CATEGORY_TTL = 60 * 60 * 24 * 30; // 30 days — an article's category is stable

// Wikipedia maintenance/meta categories that aren't meaningful topic labels.
const META_CATEGORY =
  /^(Articles|All |Pages |Wikipedia|Webarchive|CS1|Use |Short description|Commons|Good articles|Featured|Coordinates|Hidden|Disambiguation|Redirects|Wikidata|Engvar|Dynamic lists|Vague|Use dmy|Use mdy)/i;

/** The article's top "real" Wikipedia category — used to color live nodes by Wikipedia's
    own taxonomy rather than a fixed enum. Returns the first non-hidden, non-meta category. */
export async function getArticleCategory(title: string): Promise<string | null> {
  return cached(`wiki:category:${title}`, CATEGORY_TTL, async () => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "categories",
      titles: title,
      clshow: "!hidden",
      cllimit: "20",
      redirects: "1",
      origin: "*",
    });
    const res = await wikiFetch(`${ACTION_BASE}?${params.toString()}`, { revalidate: CATEGORY_TTL });
    if (!res.ok) {
      discard(res);
      return null;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { categories?: { title: string }[] }> };
    };
    const pages = data.query?.pages ?? {};
    const cats = Object.values(pages)
      .flatMap((p) => p.categories ?? [])
      .map((c) => c.title.replace(/^Category:/, ""))
      .filter((c) => !META_CATEGORY.test(c));
    return cats[0] ?? null;
  });
}

// Namespaces that are not real articles (File:, Help:, Category:, etc.).
const NON_ARTICLE_PREFIX = /^(File|Image|Help|Category|Template|Wikipedia|Portal|Special|Talk|User|Module|Draft|MediaWiki):/i;

// Low-value "burrow deeper" targets: corporate entities, list/index pages, year/number
// stubs, and language/format housekeeping that clutter the in-article link dump.
const LOW_VALUE_TITLE =
  /(\b(Inc|Ltd|LLC|GmbH|Co|Corporation|Company)\b\.?$)|(\bS\.p\.A\.?$)|(^(List|Index|Outline|Timeline|History|Glossary) of )|(\((company|disambiguation)\))|(^\d{3,4}$)|(^[A-Z]+ \d)|(English$)/i;

/** The next jumps a reader can burrow into, ranked by CONCEPTUAL RELEVANCE — what's
    actually related to the topic, not what's merely popular or alphabetically first:
      1. `morelike:` search — Wikipedia's own content-similarity ranking (the strong signal:
         e.g. Black hole → Schwarzschild radius, Event horizon, Gravitational collapse),
      2. in-article links the summary extract mentions (the lead-section on-ramps),
      3. remaining in-article links, as a last-resort top-up.
    Main namespace only, house-keeping + low-value stubs filtered. */
export async function getArticleLinks(title: string, limit = 40): Promise<BlueLink[]> {
  return cached(`wiki:links:${title}:${limit}`, LINKS_TTL, async () => {
    const seen = new Set<string>([title]); // never link an article back to itself
    const out: BlueLink[] = [];
    const push = (titles: string[]) => {
      for (const t of titles) {
        if (out.length >= limit) break;
        if (!t || NON_ARTICLE_PREFIX.test(t) || LOW_VALUE_TITLE.test(t) || seen.has(t)) continue;
        seen.add(t);
        out.push({ title: t });
      }
    };

    const [similar, summary, inTextRaw] = await Promise.all([
      getSimilarArticles(title, limit),
      getPageSummary(title).catch(() => null),
      getInArticleLinks(title, limit),
    ]);

    // 1) content-similarity (the primary relevance signal)
    push(similar);

    // 2) lead-section links the extract mentions
    const extract = (summary?.extract ?? "").toLowerCase();
    if (extract && out.length < limit) {
      push(inTextRaw.filter((t) => extract.includes(t.toLowerCase())));
    }

    // 3) remaining in-article links (only if still short)
    if (out.length < limit) push(inTextRaw);

    return out;
  });
}

/** Wikipedia "morelike" search — content-similar articles, the best relatedness signal. */
async function getSimilarArticles(title: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    srsearch: `morelike:${title}`,
    srnamespace: "0",
    srlimit: String(Math.min(limit + 6, 50)),
    srqiprofile: "classic_noboostlinks",
    origin: "*",
  });
  const res = await wikiFetch(`${ACTION_BASE}?${params.toString()}`, { revalidate: LINKS_TTL });
  if (!res.ok) {
    discard(res);
    return [];
  }
  const data = (await res.json()) as {
    query?: { search?: { title: string }[] };
  };
  return (data.query?.search ?? []).map((s) => s.title);
}

/** The article's in-text links (main namespace), in API order. */
async function getInArticleLinks(title: string, limit: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "links",
    titles: title,
    plnamespace: "0",
    pllimit: String(Math.min(limit * 6, 500)),
    redirects: "1",
    origin: "*",
  });
  const res = await wikiFetch(`${ACTION_BASE}?${params.toString()}`, { revalidate: LINKS_TTL });
  if (!res.ok) {
    discard(res);
    return [];
  }
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { links?: { title: string }[] }> };
  };
  const pages = data.query?.pages ?? {};
  return Object.values(pages).flatMap((p) => (p.links ?? []).map((l) => l.title));
}
