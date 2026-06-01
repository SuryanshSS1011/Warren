// Server-only Wikimedia REST client. Always route Wikipedia calls through this
// module so we control the User-Agent, caching, and rate limits.
//
// See INITIAL_PLAN_WARREN.md §3 "Wikipedia API & data layer" for the limits
// (~3 concurrent, respect Retry-After) and the endpoints we use.
import "server-only";
import { getServerEnv } from "@/lib/env/server";

const REST_BASE = "https://en.wikipedia.org/api/rest_v1";

async function wikiFetch(path: string, init?: RequestInit) {
  const { WIKIPEDIA_USER_AGENT } = getServerEnv();
  return fetch(`${REST_BASE}${path}`, {
    ...init,
    headers: {
      "User-Agent": WIKIPEDIA_USER_AGENT,
      "Api-User-Agent": WIKIPEDIA_USER_AGENT,
      "Accept-Encoding": "gzip",
      ...init?.headers,
    },
    next: { revalidate: 60 * 60 * 24 },
  });
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
  const res = await wikiFetch(`/page/summary/${encodeURIComponent(title)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia summary ${title}: ${res.status}`);
  return (await res.json()) as PageSummary;
}

export async function getRelated(title: string) {
  const res = await wikiFetch(`/page/related/${encodeURIComponent(title)}`);
  if (!res.ok) return { pages: [] as PageSummary[] };
  return (await res.json()) as { pages: PageSummary[] };
}
