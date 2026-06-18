"use client";

import useSWR from "swr";
import { jsonFetcher, summaryKey, linksKey, type LiveSummary, type LiveLinks } from "@/lib/explore/api";

/** Background-enrich a corpus article with its live Wikipedia summary (real thumbnail +
    canonical extract) and links. Returns null while loading or if the proxy/title is unavailable,
    so callers can fall back to the offline corpus without any flash of empty content. */
export function useLiveArticle(title: string | null) {
  const { data: summary, error: summaryError, isLoading: summaryLoading } = useSWR<LiveSummary>(
    summaryKey(title),
    jsonFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 1000 * 60 * 10,
    },
  );

  const { data: links, error: linksError, isLoading: linksLoading } = useSWR<LiveLinks>(
    linksKey(title),
    jsonFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 1000 * 60 * 10,
    },
  );

  // A disambiguation response carries no usable extract/thumbnail — treat it as "no live
  // data" so the burrow card falls back to the offline corpus instead of rendering empty.
  const usableSummary = summary && summary.type !== "disambiguation" ? summary : null;
  
  return {
    live: summaryError ? null : usableSummary,
    links: linksError ? null : (links?.links ?? null),
    isLoading: summaryLoading || linksLoading,
  };
}
