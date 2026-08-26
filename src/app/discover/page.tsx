import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { Roulette } from "@/components/discover/Roulette";
import { onThisDay, trending, type DiscoverItem } from "@/lib/wikipedia/discover";
import { TOURS } from "@/lib/explore/tours";
import styles from "./discover.module.css";

export const metadata: Metadata = {
  title: "Discover — Warren",
  description: "On this day, what the world is reading, and a random rabbit hole to fall into.",
};

// Revalidate hourly — the feeds are cached in the lib layer too.
export const revalidate = 3600;

function startHref(title: string) {
  return `/?start=${encodeURIComponent(title)}`;
}

function ItemCard({ item }: { item: DiscoverItem }) {
  return (
    <Link href={startHref(item.title)} className={styles.card}>
      {item.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.cardThumb} src={item.thumbnail} alt="" loading="lazy" />
      ) : (
        <div className={styles.cardThumbEmpty} aria-hidden />
      )}
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>
          {item.year != null ? <span className={styles.year}>{item.year}</span> : null}
          {item.title}
        </div>
        {item.extract ? <p className={styles.cardExtract}>{item.extract}</p> : null}
        <span className={styles.cardStart}>Start a warren →</span>
      </div>
    </Link>
  );
}

export default async function DiscoverPage() {
  const [otd, trend] = await Promise.all([onThisDay(), trending()]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Warren
        </Link>
        <h1 className={styles.h1}>Discover</h1>
        <p className={styles.sub}>Somewhere to fall in. Pick a thread and start burrowing.</p>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Guided tours</h2>
          <div className={styles.tourGrid}>
            {TOURS.map((tour) => (
              <Link
                key={tour.slug}
                href={startHref(tour.path[0])}
                className={styles.tourCard}
              >
                <div className={styles.tourGlyph} aria-hidden>
                  {tour.glyph}
                </div>
                <div className={styles.tourTitle}>{tour.title}</div>
                <p className={styles.tourBlurb}>{tour.blurb}</p>
                <div className={styles.tourPath}>{tour.path.join(" → ")}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Feeling lucky</h2>
          <Roulette />
        </section>

        {trend.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>What the world is reading</h2>
            <div className={styles.grid}>
              {trend.map((it) => (
                <ItemCard key={`t-${it.title}`} item={it} />
              ))}
            </div>
          </section>
        ) : null}

        {otd.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>On this day</h2>
            <div className={styles.grid}>
              {otd.map((it) => (
                <ItemCard key={`o-${it.year}-${it.title}`} item={it} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
