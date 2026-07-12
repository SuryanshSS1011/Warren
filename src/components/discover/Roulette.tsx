"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/discover/discover.module.css";

type Item = { title: string; extract: string };

/** Taste roulette: fetch a random article and offer to start a warren from it. Free, uncached. */
export function Roulette() {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  async function spin() {
    setBusy(true);
    try {
      const res = await fetch("/api/discover?kind=random");
      const data = (await res.json()) as { item: Item | null };
      setItem(data.item);
    } catch {
      setItem(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.roulette}>
      <button className={styles.spinBtn} onClick={spin} disabled={busy}>
        {busy ? "Spinning…" : "🎲 Random article"}
      </button>
      {item ? (
        <div className={styles.rouletteCard}>
          <div className={styles.rouletteTitle}>{item.title}</div>
          <p className={styles.rouletteExtract}>{item.extract}</p>
          <button
            className={styles.startBtn}
            onClick={() => router.push(`/?start=${encodeURIComponent(item.title)}`)}
          >
            Start a warren from this →
          </button>
        </div>
      ) : null}
    </div>
  );
}
