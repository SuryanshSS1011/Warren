"use client";

import { useEffect } from "react";
import useSWR from "swr";
import {
  categoryKey,
  jsonFetcher,
  linksKey,
  summaryKey,
  type LiveCategory,
  type LiveLinks,
  type LiveSummary,
} from "@/lib/explore/api";
import { liveIdFor, upsertLive } from "@/lib/explore/article-store";

/** Background-enrich an article with its live Wikipedia summary (real thumbnail +
    canonical extract) AND its in-article blue links. Writes the result into the shared
    article store (keyed by a live: id) so chips can spawn real Wikipedia nodes. Returns
    null while loading or if the proxy/title is unavailable so callers fall back to the
    offline corpus without a flash of empty content. */
export function useLiveArticle(title: string | null) {
  const summary = useSWR<LiveSummary>(summaryKey(title), jsonFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 1000 * 60 * 10,
  });
  const links = useSWR<LiveLinks>(linksKey(title, 14), jsonFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 1000 * 60 * 10,
  });
  // The article's real Wikipedia category → colors the live node by Wikipedia's taxonomy.
  const category = useSWR<LiveCategory>(categoryKey(title), jsonFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    dedupingInterval: 1000 * 60 * 30,
  });

  // A disambiguation response carries no usable extract — treat it as "no live data".
  const data = summary.data;
  const usable = data && data.type !== "disambiguation" ? data : null;
  const liveLinks = links.data?.links ?? null;
  const liveCategory = category.data?.category ?? null;

  // Mirror live data into the shared store so the graph can resolve live: nodes.
  useEffect(() => {
    if (!usable && !liveLinks && !liveCategory) return;
    upsertLive({
      title: title!,
      category: liveCategory ?? undefined,
      extract: usable?.extract,
      description: usable?.description,
      thumbnail: usable?.thumbnail?.source,
      links: liveLinks ? liveLinks.map((l) => liveIdFor(l.title)) : undefined,
    });
  }, [title, usable, liveLinks, liveCategory]);

  return {
    live: summary.error ? null : usable,
    liveLinks: links.error ? null : liveLinks,
    isLoading: summary.isLoading,
  };
}
