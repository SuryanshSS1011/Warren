"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/explore.module.css";
import { tierAllows, type Tier } from "@/lib/billing/tiers";

/**
 * Generates spaced-repetition cards from the current article and saves them to the viewer's
 * deck (Pro). Non-Pro viewers are nudged to /pricing. Part of the Learn pillar's on-ramp.
 */
export function AddToLearn({ title, tier }: { title: string; tier: Tier }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "adding" | "done" | "error">("idle");
  const [count, setCount] = useState(0);

  const canUse = tierAllows(tier, "spaced_repetition");

  async function add() {
    if (!canUse) {
      router.push("/pricing");
      return;
    }
    setState("adding");
    try {
      const res = await fetch("/api/learn/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.status === 402) {
        router.push("/pricing");
        setState("idle");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { created: number };
      setCount(data.created);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className={styles.learnDone}>
        Added {count} cards ·{" "}
        <a href="/learn" className={styles.learnLink}>
          Study now →
        </a>
      </span>
    );
  }

  return (
    <button className={styles.learnBtn} onClick={add} disabled={state === "adding"}>
      {state === "adding" ? "Making cards…" : state === "error" ? "Try again" : "✦ Add to Learn"}
    </button>
  );
}
