"use client";

import { useState, useTransition } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import styles from "@/app/explore.module.css";
import { ARTICLES, hueOf, labelOf } from "@/lib/explore/corpus";
import { searchWiki } from "@/lib/explore/actions";

type ArticlePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentIds: string[];
  onPick: (id: string) => void;
};

/** ⌘K command palette to search the corpus and jump to (or start from) any article.
    Built on cmdk for fuzzy search + full keyboard nav. */
export default function ArticlePalette({
  open,
  onOpenChange,
  presentIds,
  onPick,
}: ArticlePaletteProps) {
  const [query, setQuery] = useState("");
  const [wikiResults, setWikiResults] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearchChange = (q: string) => {
    setQuery(q);
    if (q.length < 3) {
      setWikiResults([]);
      return;
    }

    startTransition(async () => {
      const results = await searchWiki(q);
      setWikiResults(results);
    });
  };

  const present = new Set(presentIds);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <VisuallyHidden>
            <Dialog.Title>Find an article</Dialog.Title>
          </VisuallyHidden>
          <Command label="Find an article" loop shouldFilter={!query}>
            <Command.Input
              className={styles.cmdInput}
              placeholder="Search articles to burrow into…"
              autoFocus
              value={query}
              onValueChange={handleSearchChange}
            />
            <Command.List className={styles.listScroll}>
              <Command.Empty className={styles.cmdEmpty}>No matching articles.</Command.Empty>
              
              <Command.Group heading="Demo Corpus">
                {ARTICLES.map((a) => {
                  const h = hueOf(a.category);
                  const inMap = present.has(a.id);
                  return (
                    <Command.Item
                      key={a.id}
                      value={`${a.title} ${labelOf(a.category)} ${a.blurb}`}
                      className={styles.listItem}
                      onSelect={() => {
                        onPick(a.id);
                        onOpenChange(false);
                      }}
                    >
                      <span className={styles.listBody}>
                        <span className={styles.listRow}>
                          <span
                            className={styles.listDot}
                            style={{ background: `oklch(0.72 0.15 ${h})` }}
                          />
                          <span className={styles.listName}>{a.title}</span>
                          <span className={styles.listCat}>{labelOf(a.category)}</span>
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

              {wikiResults.length > 0 && (
                <Command.Group heading="Wikipedia">
                  {wikiResults.map((title) => (
                    <Command.Item
                      key={title}
                      value={title}
                      className={styles.listItem}
                      onSelect={() => {
                        // For now, if it's not in the corpus, we just show a toast 
                        // or handle it if we can. 
                        // The user said they wanted to "add to the gallery".
                        // We'll pass it to onPick and let ExploreMap handle it.
                        onPick(title);
                        onOpenChange(false);
                      }}
                    >
                      <span className={styles.listBody}>
                        <span className={styles.listRow}>
                          <span className={styles.listName}>{title}</span>
                          <span className={styles.listCat}>Wikipedia</span>
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
