"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import styles from "@/app/explore.module.css";
import { ARTICLES, hueOf } from "@/lib/explore/corpus";
import { liveIdFor, upsertLive } from "@/lib/explore/article-store";

type ArticlePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentIds: string[];
  onPick: (id: string) => void;
};

/** ⌘K command palette. Searches the offline corpus AND live Wikipedia (debounced), so a
    user can jump to / start from ANY article. Built on cmdk for keyboard nav. */
export default function ArticlePalette({
  open,
  onOpenChange,
  presentIds,
  onPick,
}: ArticlePaletteProps) {
  const present = new Set(presentIds);
  const [query, setQuery] = useState("");
  const [wikiResults, setWikiResults] = useState<string[]>([]);

  // Debounced live Wikipedia search. The synchronous reset on an empty query is an
  // intentional clear (not a cascading fetch), so the rule is scoped-disabled here.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const q = query.trim();
    let cancelled = false;
    if (q.length < 2) {
      setWikiResults((prev) => (prev.length ? [] : prev));
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wiki/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: string[] };
        if (!cancelled) setWikiResults(data.results ?? []);
      } catch {
        /* ignore — corpus results still show */
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query]);

  const pick = (id: string) => {
    onPick(id);
    onOpenChange(false);
  };

  // We filter both lists ourselves (cmdk's own filter would drop live results whose title
  // doesn't lexically contain the query, e.g. "NYC" → "New York City"). Corpus: simple
  // case-insensitive match over title/category/blurb. Live: already filtered by the API.
  const q = query.trim().toLowerCase();
  const corpusMatches = q
    ? ARTICLES.filter((a) =>
        `${a.title} ${a.blurb}`.toLowerCase().includes(q),
      )
    : ARTICLES;
  const corpusTitles = new Set(ARTICLES.map((a) => a.title.toLowerCase()));
  const liveOnly = wikiResults.filter((t) => !corpusTitles.has(t.toLowerCase()));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <VisuallyHidden>
            <Dialog.Title>Find an article</Dialog.Title>
          </VisuallyHidden>
          {/* we filter both lists ourselves (see above), so disable cmdk's own filter */}
          <Command label="Find an article" loop shouldFilter={false}>
            <Command.Input
              className={styles.cmdInput}
              placeholder="Search the corpus or all of Wikipedia…"
              autoFocus
              value={query}
              onValueChange={setQuery}
            />
            <Command.List className={styles.listScroll}>
              <Command.Empty className={styles.cmdEmpty}>No matching articles.</Command.Empty>

              {corpusMatches.length > 0 ? (
                <Command.Group heading="Corpus">
                  {corpusMatches.map((a) => {
                  const h = hueOf(a.title);
                  const inMap = present.has(a.id);
                  return (
                    <Command.Item
                      key={a.id}
                      value={`${a.title} ${a.blurb}`}
                      className={styles.listItem}
                      onSelect={() => pick(a.id)}
                    >
                      <span className={styles.listBody}>
                        <span className={styles.listRow}>
                          <span
                            className={styles.listDot}
                            style={{ background: `oklch(0.72 0.15 ${h})` }}
                          />
                          <span className={styles.listName}>{a.title}</span>
                          {inMap ? <span className={styles.listCat}>· in map</span> : null}
                        </span>
                        <p className={styles.listBridge} style={{ fontStyle: "normal" }}>
                          {a.blurb}
                        </p>
                      </span>
                    </Command.Item>
                  );
                })}
                </Command.Group>
              ) : null}

              {liveOnly.length > 0 ? (
                <Command.Group heading="Wikipedia">
                  {liveOnly.map((title) => {
                    const id = liveIdFor(title);
                    const h = hueOf(title);
                    const inMap = present.has(id);
                    return (
                      <Command.Item
                        key={id}
                        // disable cmdk's own filtering for live items (already API-filtered)
                        value={`wiki-${title}`}
                        keywords={[title]}
                        className={styles.listItem}
                        onSelect={() => {
                          upsertLive({ title });
                          pick(id);
                        }}
                      >
                        <span className={styles.listBody}>
                          <span className={styles.listRow}>
                            <span
                              className={styles.listDot}
                              style={{ background: `oklch(0.72 0.15 ${h})` }}
                            />
                            <span className={styles.listName}>{title}</span>
                            <span className={styles.listCat}>Wikipedia</span>
                            {inMap ? <span className={styles.listCat}>· in map</span> : null}
                          </span>
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
