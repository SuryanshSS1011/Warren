import type { Metadata } from "next";
import Link from "next/link";
import styles from "./gallery.module.css";
import MiniTrail from "@/components/explore/MiniTrail";
import { listPublicWarrens, type WarrenCard } from "@/lib/explore/repository";

export const metadata: Metadata = {
  title: "Gallery — Warren",
  description: "Featured and trending Wikipedia journeys, mapped. Replay one or start your own.",
};

// Always fetch fresh public warrens.
export const dynamic = "force-dynamic";

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

export default async function GalleryPage() {
  const warrens = await listPublicWarrens(24);
  const featured = warrens.slice(0, 3);
  const trending = warrens.slice(3);

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
        <Link href="/" className={styles.cta}>
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

      {warrens.length === 0 ? (
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
    </div>
  );
}
