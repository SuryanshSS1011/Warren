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
import { usePathNarrative } from "@/hooks/usePathNarrative";
import { useLiveArticle } from "./useLiveArticle";

type BurrowCardProps = {
  article: ResolvedArticle;
  presentIds: Set<string>;
  incomingBridge: string | null;
  accent: string;
  /** Titles of the spine nodes up to (and including) the selected node. */
  pathTitles: string[];
  onChip: (fromId: string, toId: string, visited: boolean) => void;
  onClose: () => void;
  /** A blue-link inside the embedded Wikipedia reader was clicked. */
  onHopTo?: (fromTitle: string, toTitle: string) => void;
  /** The reader saved a text highlight for this node. */
  onHighlight?: (nodeId: string, text: string) => void;
};

type WikiMessage =
  | { type: "WIKI_HOP"; from: string; to: string }
  | { type: "WIKI_HIGHLIGHT"; title: string; text: string }
  | { type: "WIKI_PAGE_LOAD"; title: string };

type Chip = { id: string; title: string; category: string };

/** The in-map reading panel. Lead-image strip, the AI "bridge" sentence, the summary,
    and "burrow deeper" blue-link chips that spawn the next node (corpus OR live Wikipedia). */
export default function BurrowCard({
  article,
  presentIds,
  incomingBridge,
  accent,
  pathTitles,
  onChip,
  onClose,
  onHopTo,
  onHighlight,
}: BurrowCardProps) {
  // Summary = AI bridge + extract + chips; Wikipedia = the live embedded reader.
  const [tab, setTab] = useState<"summary" | "wikipedia">("summary");

  // The semantic path narrative for the spine leading to this node.
  const {
    narrative,
    isLoading: narrativeLoading,
    error: narrativeError,
  } = usePathNarrative(article.id, pathTitles);

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

  // Listen for hops/highlights posted from the sandboxed Wikipedia reader. Because the
  // iframe is sandboxed WITHOUT allow-same-origin, it runs in an opaque origin and its
  // postMessage origin reports as "null" — so we accept "null" OR our own origin, and
  // reject anything else.
  const articleId = article.id;
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "null" && event.origin !== window.location.origin) return;
      const data = event.data as WikiMessage | undefined;
      if (!data || typeof data !== "object") return;
      // validate each field's shape — a malformed/spoofed message must not reach handlers
      if (data.type === "WIKI_HOP") {
        if (typeof data.from === "string" && typeof data.to === "string" && data.from && data.to) {
          onHopTo?.(data.from, data.to);
        }
      } else if (data.type === "WIKI_HIGHLIGHT") {
        if (typeof data.text === "string" && data.text.trim()) {
          onHighlight?.(articleId, data.text);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [articleId, onHopTo, onHighlight]);

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
      role="region"
      aria-label={`${article.title} — reading panel`}
      style={{ "--cat-h": h, "--accent": accent } as React.CSSProperties}
      onPointerDown={(e) => e.stopPropagation()}
      {...motionProps}
      transition={{ duration: 0.42, ease: [0.2, 0.85, 0.25, 1] }}
      // mobile bottom-sheet: swipe down to dismiss
      drag={isMobile ? "y" : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_e, info) => {
        if (isMobile && (info.offset.y > 120 || info.velocity.y > 600)) onClose();
      }}
    >
      {isMobile ? <div className={styles.burrowGrabber} aria-hidden /> : null}
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
      <div className={styles.burrowTabs} role="tablist" aria-label="Reading view">
        <button
          role="tab"
          aria-selected={tab === "summary"}
          className={`${styles.burrowTab} ${tab === "summary" ? styles.burrowTabActive : ""}`}
          onClick={() => setTab("summary")}
        >
          Summary
        </button>
        <button
          role="tab"
          aria-selected={tab === "wikipedia"}
          className={`${styles.burrowTab} ${tab === "wikipedia" ? styles.burrowTabActive : ""}`}
          onClick={() => setTab("wikipedia")}
        >
          Wikipedia
        </button>
      </div>
      {tab === "wikipedia" ? (
        <div className={styles.burrowWiki}>
          <iframe
            className={styles.wikiFrame}
            src={`/api/wiki/render?title=${encodeURIComponent(article.wikiTitle)}`}
            title="Wikipedia"
            sandbox="allow-scripts allow-popups"
          />
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
        {article.blurb ? <p className={styles.burrowBlurb}>{article.blurb}</p> : null}
        {incomingBridge ? (
          <div className={styles.burrowBridge}>
            <span className={styles.burrowBridgeLabel}>the bridge here</span>
            <p>{incomingBridge}</p>
          </div>
        ) : null}
        <p className={styles.burrowExtract}>{extract}</p>
        {pathTitles.length >= 2 ? (
          <div className={styles.pathNarrative}>
            <div className={styles.burrowLinksHead}>the thread so far</div>
            {narrativeLoading ? (
              <div className={styles.narrativeSkeleton} aria-hidden>
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineShort} />
              </div>
            ) : narrativeError ? (
              <p className={styles.narrativeError}>{narrativeError}</p>
            ) : narrative ? (
              <p className={styles.narrativeText}>{narrative}</p>
            ) : null}
          </div>
        ) : null}
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
      )}
    </motion.div>
  );
}
