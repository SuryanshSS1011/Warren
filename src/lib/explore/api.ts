// Client-side fetchers for the Warren proxy routes. These let the Explore screen enrich
// the offline corpus with live Wikipedia data (real thumbnails, canonical extracts) and
// AI bridge sentences, while degrading gracefully to the corpus when offline or on error.

export type LiveSummary = {
  title: string;
  description?: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  type: string;
  content_urls?: { desktop: { page: string } };
};

export type LiveLinks = { links: { title: string }[] };

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

/** POST a from→to pair to get the cached AI bridge sentence. */
export async function fetchBridge(
  from: { title: string; description?: string },
  to: { title: string; description?: string },
): Promise<string> {
  const res = await fetch("/api/bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error(`bridge ${res.status}`);
  const data = (await res.json()) as { bridge: string };
  return data.bridge;
}

/** POST an ordered list of node titles to get a witty AI auto-title for the journey. */
export async function fetchTitle(path: string[]): Promise<string> {
  const res = await fetch("/api/title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`title ${res.status}`);
  const data = (await res.json()) as { title: string };
  return data.title;
}
