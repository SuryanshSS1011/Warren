"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/learn/learn.module.css";

type Card = { id: string; article: string; front: string; back: string };
type Rating = "again" | "hard" | "good" | "easy";

const RATINGS: { value: Rating; label: string }[] = [
  { value: "again", label: "Again" },
  { value: "hard", label: "Hard" },
  { value: "good", label: "Good" },
  { value: "easy", label: "Easy" },
];

/** Reviews the viewer's due cards: show front → flip → rate → next. Ratings drive FSRS on the
    server. Fetches the due queue on mount. */
export function StudySession() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/learn/review");
        const data = (await res.json()) as { cards?: Card[] };
        if (!cancelled) setCards(data.cards ?? []);
      } catch {
        if (!cancelled) setCards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function rate(rating: Rating) {
    if (!cards || busy) return;
    const card = cards[i];
    setBusy(true);
    try {
      await fetch("/api/learn/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating }),
      });
      setReviewed((n) => n + 1);
      setFlipped(false);
      setI((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (cards === null) {
    return <p className={styles.status}>Loading your cards…</p>;
  }

  if (cards.length === 0) {
    return (
      <div className={styles.done}>
        <p className={styles.doneTitle}>Nothing due right now ✦</p>
        <p className={styles.status}>
          Read an article and hit <em>Add to Learn</em> to build your deck.{" "}
          <Link href="/">Start exploring</Link>
        </p>
      </div>
    );
  }

  if (i >= cards.length) {
    return (
      <div className={styles.done}>
        <p className={styles.doneTitle}>Done — {reviewed} reviewed ✦</p>
        <p className={styles.status}>Come back later for the next batch.</p>
      </div>
    );
  }

  const card = cards[i];
  return (
    <div className={styles.session}>
      <div className={styles.progress}>
        {i + 1} / {cards.length} · from {card.article}
      </div>
      <button
        type="button"
        className={styles.card}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Reveal answer"}
      >
        <div className={styles.cardFace}>{flipped ? card.back : card.front}</div>
        {!flipped ? <div className={styles.cardHint}>tap to reveal</div> : null}
      </button>

      {flipped ? (
        <div className={styles.ratings}>
          {RATINGS.map((r) => (
            <button
              key={r.value}
              className={`${styles.rateBtn} ${styles[`rate_${r.value}`]}`}
              onClick={() => rate(r.value)}
              disabled={busy}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <button className={styles.revealBtn} onClick={() => setFlipped(true)}>
          Reveal answer
        </button>
      )}
    </div>
  );
}
