"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import styles from "@/app/explore.module.css";
import { hueOf, labelOf } from "@/lib/explore/corpus";
import {
  type ResolvedArticle,
  isLiveId,
  resolve,
  wikiTitleFor,
} from "@/lib/explore/article-store";
import { useLiveArticle } from "./useLiveArticle";

type BurrowCardProps = {
  article: ResolvedArticle;
  presentIds: Set<string>;
  incomingBridge: string | null;
  accent: string;
  onChip: (fromId: string, toId: string, visited: boolean) => void;
  onClose: () => void;
};

type Chip = { id: string; title: string; category: string };

/** The in-map reading panel. Lead-image strip, the AI "bridge" sentence, the summary,
    and "burrow deeper" blue-link chips that spawn the next node (corpus OR live Wikipedia). */
export default function BurrowCard({
  article,
  presentIds,
  incomingBridge,
  accent,
  onChip,
  onClose,
}: BurrowCardProps) {
  // The card centers itself vertically on desktop (translateY(-50%)) but docks as a
  // bottom sheet on mobile — so the enter/exit motion differs by breakpoint.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 880px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Background-enrich with the live Wikipedia summary (real lead image, canonical extract)
  // and the in-article blue links. Falls back to whatever the article already carries.
  const { live, liveLinks } = useLiveArticle(article.wikiTitle);

  const h = hueOf(article.category);
  const cat = labelOf(article.category);
  const extract = live?.extract || article.extract;
  const thumbSrc = live?.thumbnail?.source ?? article.thumbnail ?? null;

  // Build chips: prefer the live Wikipedia links when we have them, else the article's own
  // link ids (corpus links, or links cached from a prior fetch). Resolve each to a title.
  const linkIds =
    liveLinks && liveLinks.length
      ? liveLinks.map((l) => `live:${l.title}`)
      : article.links;
  const chips: Chip[] = linkIds
    .map((id): Chip | null => {
      const r = resolve(id);
      if (r) return { id: r.id, title: r.title, category: r.category };
      if (isLiveId(id)) return { id, title: wikiTitleFor(id), category: "Physics" };
      return null;
    })
    .filter(Boolean) as Chip[];

  const motionProps = isMobile
    ? {
        initial: { opacity: 0, y: 40 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 40 },
      }
    : {
        initial: { opacity: 0, x: 22, y: "-50%" },
        animate: { opacity: 1, x: 0, y: "-50%" },
        exit: { opacity: 0, x: 22, y: "-50%" },
      };

  return (
    <motion.div
      className={styles.burrow}
      style={{ "--cat-h": h, "--accent": accent } as React.CSSProperties}
      onPointerDown={(e) => e.stopPropagation()}
      {...motionProps}
      transition={{ duration: 0.42, ease: [0.2, 0.85, 0.25, 1] }}
    >
      <button className={styles.burrowClose} onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className={styles.burrowThumb} style={{ "--cat-h": h } as React.CSSProperties}>
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.burrowThumbImg} src={thumbSrc} alt="" />
        ) : null}
        <span className={styles.burrowThumbCap}>
          {thumbSrc ? `Wikipedia · ${article.title}` : article.imgHint}
        </span>
      </div>
      <div className={styles.burrowScroll}>
        <div className={styles.burrowCat}>
          <span
            className={styles.burrowDot}
            style={{ background: `oklch(0.72 0.15 ${h})` }}
          />
          {cat}
          <span className={styles.burrowSrc}>
            {live ? "Wikipedia · summary" : "Warren · preview"}
          </span>
        </div>
        <h2 className={styles.burrowTitle}>{article.title}</h2>
        {article.blurb ? <p className={styles.burrowBlurb}>{article.blurb}</p> : null}
        {incomingBridge ? (
          <div className={styles.burrowBridge}>
            <span className={styles.burrowBridgeLabel}>the bridge here</span>
            <p>{incomingBridge}</p>
          </div>
        ) : null}
        <p className={styles.burrowExtract}>{extract}</p>
        <div className={styles.burrowLinksHead}>Burrow deeper</div>
        <div className={styles.burrowChips}>
          {chips.map((l) => {
            const visited = presentIds.has(l.id);
            const lh = hueOf(l.category);
            return (
              <button
                key={l.id}
                className={`${styles.chip} ${visited ? styles.chipVisited : ""}`}
                style={{ "--cat-h": lh } as React.CSSProperties}
                onClick={() => onChip(article.id, l.id, visited)}
              >
                <span
                  className={styles.chipDot}
                  style={{ background: `oklch(0.72 0.15 ${lh})` }}
                />
                {l.title}
                {visited ? (
                  <span className={styles.chipMark}>in map</span>
                ) : (
                  <span className={styles.chipArrow}>→</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
