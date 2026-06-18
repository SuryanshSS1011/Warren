"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import styles from "./gallery.module.css";
import { gallerySearch, type SearchResults } from "./actions";
import MiniTrail from "@/components/explore/MiniTrail";
import type { WarrenCard } from "@/lib/explore/repository";

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.cardStars} aria-label={`${n} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? "" : styles.cardStarOff}>
          ★
        </span>
      ))}
    </span>
  );
}

function Card({ w }: { w: WarrenCard }) {
  return (
    <Link href={`/w/${w.id}`} className={styles.card}>
      <div className={styles.cardThumb}>
        <MiniTrail trail={w.trail} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{w.title}</div>
        <div className={styles.cardStats}>
          <span>
            <b>{w.stats.hops}</b> hops
          </span>
          <span className={styles.cardSep}>·</span>
          <span>
            <b>{w.stats.categories}</b> cats
          </span>
          <span className={styles.cardSep}>·</span>
          <span>
            <b>{w.stats.minutes}</b> min
          </span>
          <Stars n={w.stats.stars} />
        </div>
      </div>
    </Link>
  );
}

export default function GallerySearch({
  featured,
  trending,
}: {
  featured: WarrenCard[];
  trending: WarrenCard[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults(null);
      return;
    }

    startTransition(async () => {
      const res = await gallerySearch(q);
      setResults(res);
    });
  };

  return (
    <>
      <div className={styles.searchWrapper}>
        <div className={styles.searchBox}>
          <svg
            className={styles.searchIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search for warrens or Wikipedia articles…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {results ? (
        <div className={styles.results}>
          {results.warrens.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Matching Warrens</h2>
                <span className={styles.sectionNote}>found in gallery</span>
              </div>
              <div className={styles.grid}>
                {results.warrens.map((w) => (
                  <Card key={w.id} w={w} />
                ))}
              </div>
            </section>
          )}

          {results.wikipedia.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Wikipedia Articles</h2>
                <span className={styles.sectionNote}>start a new journey</span>
              </div>
              <div className={styles.wikiGrid}>
                {results.wikipedia.map((title) => (
                  <Link
                    key={title}
                    href={`/?start=${encodeURIComponent(title)}`}
                    className={styles.wikiCard}
                  >
                    {title} →
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.warrens.length === 0 && results.wikipedia.length === 0 && !isPending && (
            <div className={styles.empty}>
              <p>No results found for &ldquo;{query}&rdquo;.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Featured</h2>
              <span className={styles.sectionNote}>today&rsquo;s pick</span>
            </div>
            <div className={styles.grid}>
              {featured.map((w) => (
                <Card key={w.id} w={w} />
              ))}
            </div>
          </section>

          {trending.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Trending</h2>
                <span className={styles.sectionNote}>recently mapped</span>
              </div>
              <div className={styles.grid}>
                {trending.map((w) => (
                  <Card key={w.id} w={w} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
