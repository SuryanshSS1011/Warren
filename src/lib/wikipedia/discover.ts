import "server-only";
import { wikiFetch } from "./client";
import { cached } from "@/lib/cache/redis";

// Discover pillar (Phase 5): cheap, high-delight discovery from FREE Wikimedia feed APIs,
// cached aggressively. No ML personalization (deferred per PRODUCT_PLAN §2 Pillar 4). Every
// item carries a Wikipedia `title` so the UI can start a warren from it.

const REST_BASE = "https://en.wikipedia.org/api/rest_v1";

export type DiscoverItem = {
  title: string;
  extract: string;
  thumbnail?: string;
  /** for "on this day": the year the event happened */
  year?: number;
};

type RestSummary = {
  title?: string;
  normalizedtitle?: string;
  extract?: string;
  thumbnail?: { source?: string };
};

function toItem(p: RestSummary, year?: number): DiscoverItem | null {
  const title = p.normalizedtitle || p.title;
  if (!title) return null;
  return {
    title: title.replace(/_/g, " "),
    extract: p.extract ?? "",
    thumbnail: p.thumbnail?.source,
    ...(year != null ? { year } : {}),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "On this day" historical events for a given month/day (defaults to today, UTC). */
export async function onThisDay(date: Date = new Date()): Promise<DiscoverItem[]> {
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  // Cache per calendar day — the same date always yields the same events.
  return cached(`discover:otd:${mm}-${dd}`, 60 * 60 * 24, async () => {
    const res = await wikiFetch(`${REST_BASE}/feed/onthisday/events/${mm}/${dd}`, {
      revalidate: 60 * 60 * 24,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      events?: { year?: number; pages?: RestSummary[] }[];
    };
    const items: DiscoverItem[] = [];
    for (const ev of data.events ?? []) {
      const page = ev.pages?.[0];
      if (!page) continue;
      const item = toItem(page, ev.year);
      if (item) items.push(item);
      if (items.length >= 20) break;
    }
    return items;
  });
}

/** Most-read articles for a day (defaults to yesterday, UTC — today's feed can be sparse). */
export async function trending(date?: Date): Promise<DiscoverItem[]> {
  const d = date ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const mm = pad2(d.getUTCMonth() + 1);
  const dd = pad2(d.getUTCDate());
  return cached(`discover:trending:${y}-${mm}-${dd}`, 60 * 60 * 6, async () => {
    const res = await wikiFetch(`${REST_BASE}/feed/featured/${y}/${mm}/${dd}`, {
      revalidate: 60 * 60 * 6,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { mostread?: { articles?: RestSummary[] } };
    const items: DiscoverItem[] = [];
    for (const a of data.mostread?.articles ?? []) {
      const item = toItem(a);
      // Skip the main page and special entries that slip into mostread.
      if (item && !/^(Main Page|Special:|Wikipedia:)/.test(item.title)) items.push(item);
      if (items.length >= 20) break;
    }
    return items;
  });
}

/** A single random article summary — the taste-roulette seed. Not cached (randomness is the point). */
export async function randomArticle(): Promise<DiscoverItem | null> {
  const res = await wikiFetch(`${REST_BASE}/page/random/summary`, { revalidate: 0 });
  if (!res.ok) return null;
  return toItem((await res.json()) as RestSummary);
}
