"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import styles from "@/app/explore.module.css";
import { type Article, byId, hueOf, labelOf, type CategoryName } from "@/lib/explore/corpus";
import { useLiveArticle } from "./useLiveArticle";
import { usePathNarrative } from "@/hooks/usePathNarrative";

type BurrowCardProps = {
  article: Article;
  presentIds: Set<string>;
  path: string[];
  incomingBridge: string | null;
  accent: string;
  onChip: (fromId: string, toId: string, visited: boolean) => void;
  onClose: () => void;
  onEnrich?: (id: string, data: { title: string; category: CategoryName }) => void;
  onHighlight?: (nodeId: string, text: string) => void;
};

/** The in-map reading panel. Lead-image strip, the AI "bridge" sentence, the summary,
    and "burrow deeper" blue-link chips that spawn the next node. */
export default function BurrowCard({
  article,
  presentIds,
  path,
  incomingBridge,
  accent,
  onChip,
  onClose,
  onEnrich,
  onHighlight,
}: BurrowCardProps) {
  const [viewMode, setViewMode] = useState<"summary" | "wiki">("summary");

  const { narrative, isLoading: isNarrativeLoading, error: narrativeError } = usePathNarrative(article.id, path);

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

  // Background-enrich with the live Wikipedia summary (real lead image, canonical extract).
  // Falls back to the offline corpus while loading or if the proxy is unavailable.
  const { live, links: liveLinks } = useLiveArticle(article.title);

  const isInCorpus = !!byId[article.id];

  // Use AI-generated category from backend if not in corpus
  const category = isInCorpus 
    ? article.category 
    : (live as any)?.aiCategory || "Natural and physical sciences";

  // Sync enrichment back to parent if this is a live node
  useEffect(() => {
    if (!isInCorpus && live && onEnrich) {
      onEnrich(article.id, { title: live.title, category });
    }
  }, [isInCorpus, live, article.id, category, onEnrich]);

  const h = hueOf(category);
  const cat = labelOf(category);

  // Use live links if available, else corpus links. 
  const normalizedLinks = liveLinks 
    ? liveLinks.map(l => ({ id: l.title, title: l.title })) 
    : (article.links || []).map((id) => byId[id]).filter(Boolean);


  const extract = live?.extract || article.extract;
  const thumbSrc = live?.thumbnail?.source ?? null;

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

  const wikiUrl = `/api/wiki/render?title=${encodeURIComponent(article.title)}`;

  // Listen for clicks inside the proxied Wikipedia iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data.type === "WIKI_HOP") {
        const visited = presentIds.has(data.to);
        onChip(data.from, data.to, visited);
      } else if (data.type === "WIKI_PAGE_LOAD") {
        // Optionally handle page loads if we want to sync selection
      } else if (data.type === "WIKI_HIGHLIGHT") {
        onHighlight?.(article.id, data.text);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [presentIds, onChip, onHighlight, article.id]);

  return (
    <motion.div
      className={`${styles.burrow} ${viewMode === "wiki" ? styles.burrowExpanded : ""}`}
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

      <div className={styles.burrowTabs}>
        <button
          className={`${styles.burrowTab} ${viewMode === "summary" ? styles.burrowTabActive : ""}`}
          onClick={() => setViewMode("summary")}
        >
          Summary
        </button>
        <button
          className={`${styles.burrowTab} ${viewMode === "wiki" ? styles.burrowTabActive : ""}`}
          onClick={() => setViewMode("wiki")}
        >
          Wikipedia
        </button>
      </div>

      {viewMode === "wiki" ? (
        <div className={styles.burrowWiki}>
          <iframe src={wikiUrl} className={styles.wikiFrame} title="Wikipedia" />
        </div>
      ) : (
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
          <p className={styles.burrowBlurb}>{live?.description || article.blurb}</p>
          {incomingBridge ? (
            <div className={styles.burrowBridge}>
              <span className={styles.burrowBridgeLabel}>the bridge here</span>
              <p>{incomingBridge}</p>
            </div>
          ) : null}
          <p className={styles.burrowExtract}>{extract}</p>

          <div className={styles.pathNarrative}>
            <div className={styles.burrowNotesHead}>
              <span className={styles.burrowNotesIcon}>✨</span> Semantic Path Narrative
            </div>
            {isNarrativeLoading ? (
              <div className={styles.narrativeSkeleton}>
                <motion.div
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className={styles.skeletonLine}
                />
                <motion.div
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                  className={styles.skeletonLineShort}
                />
              </div>
            ) : narrative ? (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.narrativeText}
              >
                {narrative}
              </motion.p>
            ) : narrativeError ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={styles.narrativeError}
              >
                {narrativeError}
              </motion.p>
            ) : null}
          </div>

          {article.researchNotes && article.researchNotes.length > 0 && (
            <div className={styles.burrowNotes}>
              <div className={styles.burrowNotesHead}>
                <span className={styles.burrowNotesIcon}>✦</span> captured highlights
              </div>
              <div className={styles.burrowNotesList}>
                {article.researchNotes.map((note, i) => (
                  <div key={i} className={styles.burrowNote}>
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.burrowLinksHead}>Burrow deeper</div>
          <div className={styles.burrowChips}>
            {normalizedLinks.map((l) => {
              const visited = presentIds.has(l.id);
              // Detect category for the chip dot color as well
              const lh = hueOf(byId[l.id]?.category || "Physics");
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
      )}
    </motion.div>
  );
}
