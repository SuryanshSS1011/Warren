"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/explore.module.css";
import type { ArticleContent, Block, TextSpan } from "@/lib/wikipedia/content";
import { wikipediaArticleUrl, type AiAttribution as AiAttributionData } from "@/lib/attribution";
import { AiAttribution } from "./AiAttribution";
import { ListenButton } from "./ListenButton";
import { AskArticle } from "./AskArticle";
import { useTier } from "@/hooks/useTier";
import type { ReadingLevel } from "@/lib/ai/reading-level";

type Level = "original" | ReadingLevel;

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "original", label: "As written" },
  { value: "eli5", label: "ELI5" },
  { value: "simple", label: "Simple" },
  { value: "expert", label: "Expert" },
];

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
  const router = useRouter();
  const { tier } = useTier();
  const [content, setContent] = useState<ArticleContent | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // Reading level: "original" shows the source blocks; a rewrite level fetches AI-rewritten
  // prose (Pro-gated). Reset to original whenever the article changes.
  const [level, setLevel] = useState<Level>("original");
  const [rewrite, setRewrite] = useState<{ text: string; attribution: AiAttributionData } | null>(
    null,
  );
  const [rewriteState, setRewriteState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    // Reset synchronously when the article changes (intentional; no cascading fetch loop).
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    setState("loading");
    setContent(null);
    setLevel("original");
    setRewrite(null);
    setRewriteState("idle");
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

  async function changeLevel(next: Level) {
    setLevel(next);
    if (next === "original") {
      setRewrite(null);
      setRewriteState("idle");
      return;
    }
    setRewriteState("loading");
    setRewrite(null);
    try {
      const res = await fetch(
        `/api/wiki/reading-level?title=${encodeURIComponent(title)}&level=${next}`,
      );
      if (res.status === 402) {
        router.push("/pricing");
        setLevel("original");
        setRewriteState("idle");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { text: string; attribution: AiAttributionData };
      setRewrite(data);
      setRewriteState("idle");
    } catch {
      setRewriteState("error");
    }
  }

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

  // The text currently on screen — the rewrite when a level is active, else the source prose.
  const readableText =
    level !== "original" && rewrite
      ? rewrite.text
      : content.blocks.map((b) => b.spans.map((s) => s.text).join("")).join("\n\n");

  return (
    <div className={styles.reader}>
      <div className={styles.readerControls}>
        <div className={styles.levelBar} role="group" aria-label="Reading level">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.levelBtn} ${level === opt.value ? styles.levelBtnActive : ""}`}
              aria-pressed={level === opt.value}
              onClick={() => changeLevel(opt.value)}
              disabled={rewriteState === "loading"}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <ListenButton text={readableText} tier={tier} />
      </div>

      {level !== "original" ? (
        rewriteState === "loading" ? (
          <div className={styles.readerSkeleton} aria-hidden>
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLineShort} />
          </div>
        ) : rewriteState === "error" ? (
          <p className={styles.readerError}>Couldn&rsquo;t rewrite this article — try again.</p>
        ) : rewrite ? (
          <>
            {rewrite.text.split(/\n{2,}/).map((para, i) => (
              <p key={i} className={styles.readerP}>
                {para}
              </p>
            ))}
            <AiAttribution attribution={rewrite.attribution} />
          </>
        ) : null
      ) : (
        <>
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
        </>
      )}

      <AskArticle title={title} tier={tier} />
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
