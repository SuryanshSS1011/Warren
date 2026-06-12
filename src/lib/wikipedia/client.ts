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
async function wikiFetch(
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

// Namespaces that are not real articles (File:, Help:, Category:, etc.).
const NON_ARTICLE_PREFIX = /^(File|Image|Help|Category|Template|Wikipedia|Portal|Special|Talk|User|Module|Draft|MediaWiki):/i;

// Low-value "burrow deeper" targets: corporate entities, list/index pages, year/number
// stubs, and language/format housekeeping that clutter the in-article link dump.
const LOW_VALUE_TITLE =
  /(\b(Inc|Ltd|LLC|GmbH|Co|Corporation|Company)\b\.?$)|(\bS\.p\.A\.?$)|(^List of )|(^Index of )|(\((company|disambiguation)\))|(^\d{3,4}$)|(^[A-Z]+ \d)|(English$)/i;

/** The next jumps a reader can burrow into, ranked by RELEVANCE (not alphabetically):
      1. Wikipedia's curated "related" pages (best signal when present),
      2. links that appear in the article's own summary extract (the lead-section links —
         the most relevant on-ramps a reader actually meets first),
      3. remaining in-article links.
    Main namespace only, house-keeping + low-value stubs filtered. */
export async function getArticleLinks(title: string, limit = 40): Promise<BlueLink[]> {
  return cached(`wiki:links:${title}:${limit}`, LINKS_TTL, async () => {
    const seen = new Set<string>();
    const out: BlueLink[] = [];
    const push = (titles: string[]) => {
      for (const t of titles) {
        if (out.length >= limit) break;
        if (!t || NON_ARTICLE_PREFIX.test(t) || LOW_VALUE_TITLE.test(t) || seen.has(t)) continue;
        seen.add(t);
        out.push({ title: t });
      }
    };

    // Fetch curated related pages, the summary (for extract-ranking), and in-article links
    // together. Each is independently cached + concurrency-limited.
    const [related, summary, inTextRaw] = await Promise.all([
      getRelated(title),
      getPageSummary(title).catch(() => null),
      (async () => {
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
          return [] as string[];
        }
        const data = (await res.json()) as {
          query?: { pages?: Record<string, { links?: { title: string }[] }> };
        };
        const pages = data.query?.pages ?? {};
        return Object.values(pages).flatMap((p) => (p.links ?? []).map((l) => l.title));
      })(),
    ]);

    // 1) curated related
    push(related.pages.map((p) => p.title));

    // 2) in-text links that the extract actually mentions (lead-section = most relevant)
    const extract = (summary?.extract ?? "").toLowerCase();
    if (extract) {
      push(inTextRaw.filter((t) => extract.includes(t.toLowerCase())));
    }

    // 3) the rest, ranked by pageview popularity (prominent articles >> obscure stubs),
    //    which replaces the API's useless alphabetical order with a real relevance signal.
    if (out.length < limit) {
      const remaining = inTextRaw.filter(
        (t) => !seen.has(t) && !NON_ARTICLE_PREFIX.test(t) && !LOW_VALUE_TITLE.test(t),
      );
      const ranked = await rankByPageviews(Array.from(new Set(remaining)));
      push(ranked);
    }

    return out;
  });
}

/** Order candidate titles by recent pageview volume (descending). Popular articles are a
    strong proxy for relevance/prominence; obscure stubs sink. Batches to respect API
    limits and falls back to the input order if the request fails. */
async function rankByPageviews(titles: string[]): Promise<string[]> {
  if (titles.length <= 1) return titles;
  // The pageviews prop accepts up to 50 titles per query; cap the candidate pool.
  const pool = titles.slice(0, 150);
  const views = new Map<string, number>();
  for (let i = 0; i < pool.length; i += 50) {
    const batch = pool.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "pageviews",
      titles: batch.join("|"),
      pvipdays: "30",
      redirects: "1",
      origin: "*",
    });
    const res = await wikiFetch(`${ACTION_BASE}?${params.toString()}`, { revalidate: LINKS_TTL });
    if (!res.ok) {
      discard(res);
      continue;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title: string; pageviews?: Record<string, number | null> }> };
    };
    for (const p of Object.values(data.query?.pages ?? {})) {
      const total = Object.values(p.pageviews ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);
      views.set(p.title, total);
    }
  }
  return [...pool].sort((a, b) => (views.get(b) ?? 0) - (views.get(a) ?? 0));
}
