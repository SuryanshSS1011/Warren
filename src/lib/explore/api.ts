// Client-side fetchers for the Warren proxy routes. These let the Explore screen enrich
// the offline corpus with live Wikipedia data (real thumbnails, canonical extracts) and
// AI bridge sentences, while degrading gracefully to the corpus when offline or on error.

import type { AiAttribution } from "@/lib/attribution";

/** An AI text result plus its CC BY-SA / AI-generated attribution (PRODUCT_PLAN §1.1). */
export type AttributedResult = { text: string; attribution: AiAttribution | null };

export type LiveSummary = {
  title: string;
  description?: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  type: string;
  content_urls?: { desktop: { page: string } };
};

export type LiveLinks = { links: { title: string }[] };
export type LiveCategory = { category: string | null };

/** SWR fetcher: GET a JSON endpoint, throwing on non-2xx so SWR surfaces the error. */
export async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const summaryKey = (title: string | null) =>
  title ? `/api/wiki/summary?title=${encodeURIComponent(title)}` : null;

export const linksKey = (title: string | null, limit = 40) =>
  title ? `/api/wiki/links?title=${encodeURIComponent(title)}&limit=${limit}` : null;

export const categoryKey = (title: string | null) =>
  title ? `/api/wiki/category?title=${encodeURIComponent(title)}` : null;

/** POST a from→to pair to get the cached AI bridge sentence plus its attribution. */
export async function fetchBridge(
  from: { title: string; description?: string },
  to: { title: string; description?: string },
): Promise<AttributedResult> {
  const res = await fetch("/api/bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error(`bridge ${res.status}`);
  const data = (await res.json()) as { bridge: string; attribution?: AiAttribution };
  return { text: data.bridge, attribution: data.attribution ?? null };
}

/** POST an ordered list of node titles to get a witty AI auto-title plus its attribution. */
export async function fetchTitle(path: string[]): Promise<AttributedResult> {
  const res = await fetch("/api/title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`title ${res.status}`);
  const data = (await res.json()) as { title: string; attribution?: AiAttribution };
  return { text: data.title, attribution: data.attribution ?? null };
}
