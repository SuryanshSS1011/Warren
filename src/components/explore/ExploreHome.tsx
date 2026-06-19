"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import styles from "@/app/explore.module.css";
import { hueOf, STARTER_TOPICS } from "@/lib/explore/hue";

type ExploreHomeProps = {
  /** seed the session with a chosen Wikipedia article title */
  onPick: (title: string) => void;
};

/** The landing screen shown when a session has no nodes yet. Pick or search a Wikipedia
    article to begin — that becomes the first node. No corpus, no scripted demo. */
export default function ExploreHome({ onPick }: ExploreHomeProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const q = query.trim();
    let cancelled = false;
    if (q.length < 2) {
      setResults((prev) => (prev.length ? [] : prev));
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wiki/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: string[] };
        if (!cancelled) {
          const resultList = data.results ?? [];
          setResults(resultList);

          if (typeof pendo !== "undefined") {
            pendo.track("wikipedia_searched", {
              query: q,
              results_count: resultList.length,
              search_context: "home",
            });
          }
        }
      } catch {
        /* ignore — starter topics still offered */
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query]);

  const showingResults = query.trim().length >= 2 && results.length > 0;

  return (
    <motion.div
      className={styles.home}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.homeInner}>
        <h1 className={styles.homeTitle}>Where does your curiosity start?</h1>
        <p className={styles.homeSub}>
          Pick any Wikipedia article. Every hop becomes part of your warren.
        </p>

        <div className={styles.homeSearch}>
          <input
            className={styles.homeInput}
            placeholder="Search Wikipedia — anything…"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && showingResults) onPick(results[0]);
            }}
            aria-label="Search Wikipedia for a starting article"
          />
        </div>

        {/* search results, else starter topics */}
        <div className={styles.homeTopics}>
          {(showingResults ? results.slice(0, 8) : STARTER_TOPICS).map((title) => {
            const h = hueOf(title);
            return (
              <button
                key={title}
                className={styles.homeTopic}
                onClick={() => onPick(title)}
              >
                <span
                  className={styles.homeTopicDot}
                  style={{ background: `oklch(0.72 0.15 ${h})` }}
                />
                {title}
              </button>
            );
          })}
        </div>
        {!showingResults ? (
          <p className={styles.homeHint}>…or search above to start anywhere.</p>
        ) : null}
      </div>
    </motion.div>
  );
}
