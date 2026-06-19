"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import styles from "@/app/explore.module.css";
import { hueOf, STARTER_TOPICS } from "@/lib/explore/hue";
import { liveIdFor, upsertLive } from "@/lib/explore/article-store";

type ArticlePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentIds: string[];
  onPick: (id: string) => void;
};

/** ⌘K command palette. Searches all of Wikipedia (debounced). With an empty query it
    offers a few starter topics so the list is never blank. Built on cmdk for keyboard nav. */
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
        /* ignore — starter topics still show */
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [query]);

  const pickTitle = (title: string) => {
    const wasInMap = present.has(liveIdFor(title));
    const resultPosition = titles.indexOf(title);

    upsertLive({ title });
    onPick(liveIdFor(title));
    onOpenChange(false);

    if (typeof pendo !== "undefined") {
      pendo.track("palette_article_picked", {
        title,
        query: query.trim(),
        was_in_map: wasInMap,
        result_position: resultPosition,
      });
    }
  };

  // Empty query → starter topics; otherwise the live Wikipedia results (already
  // API-filtered, so we keep cmdk's own filter off and supply the rows directly).
  const titles = query.trim().length >= 2 ? wikiResults : STARTER_TOPICS;
  const heading = query.trim().length >= 2 ? "Wikipedia" : "Start anywhere";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <VisuallyHidden>
            <Dialog.Title>Find a Wikipedia article</Dialog.Title>
          </VisuallyHidden>
          {/* results are API-filtered, so disable cmdk's own filter */}
          <Command label="Find an article" loop shouldFilter={false}>
            <Command.Input
              className={styles.cmdInput}
              placeholder="Search all of Wikipedia…"
              autoFocus
              value={query}
              onValueChange={setQuery}
            />
            <Command.List className={styles.listScroll}>
              <Command.Empty className={styles.cmdEmpty}>No matching articles.</Command.Empty>

              {titles.length > 0 ? (
                <Command.Group heading={heading}>
                  {titles.map((title) => {
                    const id = liveIdFor(title);
                    const h = hueOf(title);
                    const inMap = present.has(id);
                    return (
                      <Command.Item
                        key={id}
                        value={`wiki-${title}`}
                        keywords={[title]}
                        className={styles.listItem}
                        onSelect={() => pickTitle(title)}
                      >
                        <span className={styles.listBody}>
                          <span className={styles.listRow}>
                            <span
                              className={styles.listDot}
                              style={{ background: `oklch(0.72 0.15 ${h})` }}
                            />
                            <span className={styles.listName}>{title}</span>
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
