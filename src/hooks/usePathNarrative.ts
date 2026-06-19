"use client";

import { useEffect, useState } from "react";
import { createPersistentCache } from "@/lib/explore/persistent-cache";

// localStorage-backed cache keyed by the path, so the narrative survives BurrowCard
// unmount/remount AND a full page reload — the same path on this device never refetches.
// (Cross-user reuse of the same path is handled server-side by the Redis cache in
// lib/ai/narrative.ts, which keys by the same path.)
const narrativeCache = createPersistentCache("warren:narrative:");

/** Fetch + manage the semantic path narrative for the selected node's path. */
export function usePathNarrative(focusedNodeId: string | null, path: string[]) {
  const pathKey = path.join("->");
  // Seed from cache during render (no effect needed) so a known path shows instantly.
  const cachedValue = focusedNodeId && path.length >= 1 ? narrativeCache.get(pathKey) ?? null : null;

  const [narrative, setNarrative] = useState<string | null>(cachedValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This effect synchronizes the narrative to the current path: it resets on an empty
    // path and seeds synchronously from the session cache on a hit. Those synchronous
    // setState calls are intentional (no cascading fetch), so the rule is disabled here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!focusedNodeId || path.length < 1) {
      setNarrative(null);
      return;
    }
    const hit = narrativeCache.get(pathKey);
    if (hit) {
      setNarrative(hit);
      setError(null);
      return;
    }

    let cancelled = false;
    setNarrative(null);
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/narrative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        if (!res.ok) {
          if (res.status === 429) {
            if (!cancelled) setError("AI quota reached — try again in a moment.");
            return;
          }
          throw new Error("Failed to fetch narrative");
        }
        const data = (await res.json()) as { narrative: string };
        narrativeCache.set(pathKey, data.narrative);
        if (!cancelled) setNarrative(data.narrative);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNodeId, pathKey]);

  return { narrative, isLoading, error };
}
