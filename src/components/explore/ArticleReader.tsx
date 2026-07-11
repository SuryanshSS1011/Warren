"use client";

import { useEffect, useState } from "react";
import styles from "@/app/explore.module.css";
import type { ArticleContent, Block, TextSpan } from "@/lib/wikipedia/content";
import { wikipediaArticleUrl } from "@/lib/attribution";

/**
 * Native typography reader — replaces the old sandboxed Wikipedia iframe. Renders the article's
 * prose as safe blocks (no raw HTML) in Warren's own type. Internal article links don't
 * navigate; they call onHopTo(from, to) so the click spawns a graph node (warrens are graphs).
 */
export function ArticleReader({
  title,
  onHopTo,
}: {
  title: string;
  onHopTo?: (fromTitle: string, toTitle: string) => void;
}) {
  const [content, setContent] = useState<ArticleContent | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    // Reset synchronously when the article changes (intentional; no cascading fetch loop).
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    setState("loading");
    setContent(null);
    (async () => {
      try {
        const res = await fetch(`/api/wiki/content?title=${encodeURIComponent(title)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ArticleContent;
        if (!cancelled) {
          setContent(data);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [title]);

  if (state === "loading") {
    return (
      <div className={styles.readerSkeleton} aria-hidden>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLineShort} />
        <div className={styles.skeletonLine} />
      </div>
    );
  }

  if (state === "error" || !content || content.blocks.length === 0) {
    return (
      <p className={styles.readerError}>
        Couldn&rsquo;t load the full article.{" "}
        <a href={wikipediaArticleUrl(title)} target="_blank" rel="noopener noreferrer">
          Read it on Wikipedia →
        </a>
      </p>
    );
  }

  return (
    <div className={styles.reader}>
      {content.blocks.map((block, i) => (
        <BlockView key={i} block={block} sourceTitle={title} onHopTo={onHopTo} />
      ))}
      <p className={styles.readerAttribution}>
        From{" "}
        <a href={wikipediaArticleUrl(title)} target="_blank" rel="noopener noreferrer">
          {title} on Wikipedia
        </a>
        , under CC BY-SA 4.0.
      </p>
    </div>
  );
}

function BlockView({
  block,
  sourceTitle,
  onHopTo,
}: {
  block: Block;
  sourceTitle: string;
  onHopTo?: (fromTitle: string, toTitle: string) => void;
}) {
  const spans = block.spans.map((s, i) => (
    <SpanView key={i} span={s} sourceTitle={sourceTitle} onHopTo={onHopTo} />
  ));
  if (block.type === "heading") {
    return block.level === 2 ? (
      <h3 className={styles.readerH2}>{spans}</h3>
    ) : (
      <h4 className={styles.readerH3}>{spans}</h4>
    );
  }
  return <p className={styles.readerP}>{spans}</p>;
}

function SpanView({
  span,
  sourceTitle,
  onHopTo,
}: {
  span: TextSpan;
  sourceTitle: string;
  onHopTo?: (fromTitle: string, toTitle: string) => void;
}) {
  if ("link" in span) {
    return (
      <button
        type="button"
        className={styles.readerLink}
        onClick={() => onHopTo?.(sourceTitle, span.link)}
        title={`Burrow into ${span.link}`}
      >
        {span.text}
      </button>
    );
  }
  return <>{span.text}</>;
}
