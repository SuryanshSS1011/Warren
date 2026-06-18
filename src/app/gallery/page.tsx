import type { Metadata } from "next";
import Link from "next/link";
import styles from "./gallery.module.css";
import { listPublicWarrens } from "@/lib/explore/repository";
import GallerySearch from "./GallerySearch";

export const metadata: Metadata = {
  title: "Gallery — Warren",
  description: "Featured and trending Wikipedia journeys, mapped. Replay one or start your own.",
};

// Always fetch fresh public warrens.
export const dynamic = "force-dynamic";

import { ARTICLES } from "@/lib/explore/corpus";

export default async function GalleryPage() {
  const warrens = await listPublicWarrens(24);
  const featured = warrens.slice(0, 3);
  const trending = warrens.slice(3);

  // Start with a random interesting article from the corpus if they click "Start your own".
  const randomStart = ARTICLES[Math.floor(Math.random() * ARTICLES.length)].title;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} style={{ textDecoration: "none", color: "inherit" }}>
          <svg className={styles.logo} viewBox="0 0 36 28" width={36} height={28}>
            <line x1={6} y1={21} x2={14} y2={8} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
            <line x1={14} y1={8} x2={24} y2={15} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
            <line x1={24} y1={15} x2={31} y2={6} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
            <circle cx={6} cy={21} r={2.4} fill="currentColor" />
            <circle cx={14} cy={8} r={3} fill="currentColor" />
            <circle cx={24} cy={15} r={2.4} fill="currentColor" />
            <circle cx={31} cy={6} r={3.4} fill="var(--accent)" />
          </svg>
          <div>
            <div className={styles.brandName}>Warren</div>
            <div className={styles.brandTag}>Gallery</div>
          </div>
        </Link>
        <Link href={`/?start=${encodeURIComponent(randomStart)}`} className={styles.cta}>
          Start your own →
        </Link>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Wander someone else&rsquo;s <span className={styles.heroAccent}>rabbit hole</span>.
        </h1>
        <p className={styles.heroSub}>
          Every warren is a real Wikipedia journey, mapped. Replay one to watch it animate
          back to life — then fork it and keep exploring.
        </p>
      </section>

      <GallerySearch featured={featured} trending={trending} />

      {warrens.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyCard}>
            <h3>No public warrens yet</h3>
            <p>
              Be the first — <Link href="/" className={styles.heroAccent}>map a journey</Link> and
              hit Share. Saved warrens are public by default and show up here.
            </p>
            <p style={{ marginTop: 14, fontSize: 12 }}>
              (If you expected warrens here, the gallery needs Supabase configured:{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> + <code>SUPABASE_SECRET_KEY</code>.)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
