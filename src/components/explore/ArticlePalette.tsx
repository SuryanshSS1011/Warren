"use client";

import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import styles from "@/app/explore.module.css";
import { ARTICLES, hueOf, labelOf } from "@/lib/explore/corpus";

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
  const present = new Set(presentIds);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <VisuallyHidden>
            <Dialog.Title>Find an article</Dialog.Title>
          </VisuallyHidden>
          <Command label="Find an article" loop>
            <Command.Input
              className={styles.cmdInput}
              placeholder="Search articles to burrow into…"
              autoFocus
            />
            <Command.List className={styles.listScroll}>
              <Command.Empty className={styles.cmdEmpty}>No matching articles.</Command.Empty>
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
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
