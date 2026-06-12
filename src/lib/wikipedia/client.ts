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

/** The next jumps a reader can burrow into. Prefers Wikipedia's curated "related" pages
    (genuinely relevant, not alphabetical noise), falling back to in-article links when
    related is empty. Main namespace only, house-keeping filtered. */
export async function getArticleLinks(title: string, limit = 40): Promise<BlueLink[]> {
  return cached(`wiki:links:${title}:${limit}`, LINKS_TTL, async () => {
    const dedupe = (titles: string[]): BlueLink[] => {
      const seen = new Set<string>();
      const out: BlueLink[] = [];
      for (const t of titles) {
        if (!t || NON_ARTICLE_PREFIX.test(t) || LOW_VALUE_TITLE.test(t) || seen.has(t)) continue;
        seen.add(t);
        out.push({ title: t });
        if (out.length >= limit) break;
      }
      return out;
    };

    // 1) Curated related pages (high quality).
    const related = await getRelated(title);
    const relatedLinks = dedupe(related.pages.map((p) => p.title));
    if (relatedLinks.length >= Math.min(6, limit)) return relatedLinks;

    // 2) Fall back to (or top up with) the article's in-text links.
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "links",
      titles: title,
      plnamespace: "0",
      pllimit: String(Math.min(limit * 4, 500)),
      redirects: "1",
      origin: "*",
    });
    const res = await wikiFetch(`${ACTION_BASE}?${params.toString()}`, {
      revalidate: LINKS_TTL,
    });
    if (!res.ok) {
      discard(res);
      return relatedLinks;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { links?: { title: string }[] }> };
    };
    const pages = data.query?.pages ?? {};
    const inText = Object.values(pages).flatMap((p) => (p.links ?? []).map((l) => l.title));
    return dedupe([...relatedLinks.map((l) => l.title), ...inText]);
  });
}
