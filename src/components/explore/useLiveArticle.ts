"use client";

import useSWR from "swr";
import { jsonFetcher, summaryKey, type LiveSummary } from "@/lib/explore/api";

/** Background-enrich a corpus article with its live Wikipedia summary (real thumbnail +
    canonical extract). Returns null while loading or if the proxy/title is unavailable,
    so callers can fall back to the offline corpus without any flash of empty content. */
export function useLiveArticle(title: string | null) {
  const { data, error, isLoading } = useSWR<LiveSummary>(
    summaryKey(title),
    jsonFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 1000 * 60 * 10,
    },
  );
  // A disambiguation response carries no usable extract/thumbnail — treat it as "no live
  // data" so the burrow card falls back to the offline corpus instead of rendering empty.
  const usable = data && data.type !== "disambiguation" ? data : null;
  return {
    live: error ? null : usable,
    isLoading,
  };
}
