"use client";

import { useEffect, useState } from "react";
import type { Tier } from "@/lib/billing/tiers";

type MeState = { tier: Tier; signedIn: boolean; loading: boolean };

/**
 * The viewer's effective tier for CLIENT-SIDE feature gating (server-computed, fetched once).
 * Use only for gating client-only features (e.g. browser TTS); server routes gate themselves
 * via can(). Defaults to free while loading and on error.
 */
export function useTier(): MeState {
  const [state, setState] = useState<MeState>({ tier: "free", signedIn: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { tier: Tier; signedIn: boolean };
        if (!cancelled) setState({ tier: data.tier, signedIn: data.signedIn, loading: false });
      } catch {
        if (!cancelled) setState({ tier: "free", signedIn: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
