"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import styles from "@/app/explore.module.css";
import { hueOf, labelOf } from "@/lib/explore/corpus";
import { placeholder, resolve } from "@/lib/explore/article-store";
import type { GraphEdge } from "./types";

type WarrenListProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spineIds: string[];
  presentIds: string[];
  edges: GraphEdge[];
  title: string;
  onSelect: (id: string) => void;
};

/** A parallel, fully keyboard-navigable text view of the warren — the accessibility
    requirement for the screen-reader-hostile force graph. Doubles as an export-friendly
    outline: the spine in order, then any side branches, each with its bridge sentence. */
export default function WarrenList({
  open,
  onOpenChange,
  spineIds,
  presentIds,
  edges,
  title,
  onSelect,
}: WarrenListProps) {
  const bridgeInto = (id: string) => {
    const e = edges.find((x) => x.target === id && x.spine) ?? edges.find((x) => x.target === id);
    return e?.bridge ?? null;
  };

  const spineSet = new Set(spineIds);
  const branches = presentIds.filter((id) => !spineSet.has(id));

  const renderItem = (id: string, index: number | null, onSpine: boolean) => {
    const a = resolve(id) ?? placeholder(id);
    const h = hueOf(a.category);
    const bridge = index === 0 ? null : bridgeInto(id);
    return (
      <button
        key={id}
        className={`${styles.listItem} ${onSpine ? styles.spine : ""}`}
        onClick={() => {
          onSelect(id);
          onOpenChange(false);
        }}
      >
        {index !== null ? <span className={styles.listIndex}>{index + 1}</span> : null}
        <span className={styles.listBody}>
          <span className={styles.listRow}>
            <span className={styles.listDot} style={{ background: `oklch(0.72 0.15 ${h})` }} />
            <span className={styles.listName}>{a.title}</span>
            <span className={styles.listCat}>{labelOf(a.category)}</span>
          </span>
          {bridge ? <p className={styles.listBridge}>{bridge}</p> : null}
        </span>
      </button>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <div className={styles.panelHead}>
            <Dialog.Title className={styles.panelTitle}>{title}</Dialog.Title>
            <span className={styles.panelSub}>
              {spineIds.length} on spine · {branches.length} branches
            </span>
          </div>
          <VisuallyHidden>
            <Dialog.Description>
              A keyboard-navigable text outline of your warren. Tab through articles and press
              Enter to open one in the map.
            </Dialog.Description>
          </VisuallyHidden>
          <div className={styles.listScroll}>
            {spineIds.map((id, i) => renderItem(id, i, true))}
            {branches.length > 0 ? (
              <>
                <div className={styles.panelSub} style={{ padding: "14px 12px 6px" }}>
                  Side branches
                </div>
                {branches.map((id) => renderItem(id, null, false))}
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
