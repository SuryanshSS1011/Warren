"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "@/app/explore.module.css";
import { hueOf } from "@/lib/explore/hue";
import type { SuperWarren } from "@/lib/explore/repository";
import CanvasGraphEngine from "./CanvasGraphEngine";
import MiniTrail from "./MiniTrail";
import Starfield from "./Starfield";
import type { GraphApi, GraphEdge, GraphNode } from "./types";

const ACCENT = "#e9b44c";

/** The Super Warren — a meta-graph where each node is a saved warren (a whole session) and
    two warrens are linked when they share articles. Reuses the Explore graph engine (and
    its verified pan/zoom/fit controls) by mapping warrens → GraphNode and shared-article
    overlaps → GraphEdge. Selecting a warren previews its trail with a link to replay it. */
export default function SuperWarrenMap({ data }: { data: SuperWarren }) {
  const apiRef = useRef<GraphApi | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labelMode, setLabelMode] = useState<"auto" | "all" | "off">("auto");
  const [panMode, setPanMode] = useState(false);

  const nodes: GraphNode[] = useMemo(
    () =>
      data.warrens.map((w) => ({
        id: w.id,
        depth: 0,
        category: w.field,
        title: w.title,
      })),
    [data.warrens],
  );

  // shared-article overlaps → edges. Heavier overlaps render as "spine" (gold, thicker).
  const edges: GraphEdge[] = useMemo(
    () =>
      data.links.map((l) => ({
        source: l.source,
        target: l.target,
        spine: l.shared >= 2,
        bridge: `${l.shared} shared: ${l.sharedTitles.join(", ")}`,
      })),
    [data.links],
  );

  const selected = data.warrens.find((w) => w.id === selectedId) || null;
  const isMobile = false;

  if (data.warrens.length === 0) {
    return (
      <div className={styles.root}>
        <Starfield density={0.9} />
        <div className={styles.home}>
          <div className={styles.homeInner}>
            <h1 className={styles.homeTitle}>No warrens yet</h1>
            <p className={styles.homeSub}>
              Explore and save a few journeys — they’ll appear here, linked by the articles
              they share.
            </p>
            <div className={styles.homeTopics}>
              <Link className={styles.homeTopic} href="/" style={{ textDecoration: "none" }}>
                Start a warren →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Starfield density={0.9} />

      <CanvasGraphEngine
        nodes={nodes}
        edges={edges}
        selectedId={selectedId}
        spineIds={[]}
        newestId={null}
        accent={ACCENT}
        labelMode={labelMode}
        dimmed={false}
        panMode={panMode}
        reserveRight={selected && !isMobile ? 360 : 0}
        reserveBottom={0}
        reserveTop={0}
        onSelect={setSelectedId}
        onReady={(api) => {
          apiRef.current = api;
        }}
      />

      {/* top-left brand */}
      <header className={styles.header}>
        <Link href="/" className={styles.brand} style={{ textDecoration: "none" }}>
          <div>
            <div className={styles.brandName}>Warren</div>
            <div className={styles.brandTag}>Super Warren — how your journeys connect</div>
          </div>
        </Link>
      </header>

      <div className={styles.controls}>
        <div className={styles.zoomCluster}>
          <button className={styles.zoomBtn} aria-label="Zoom out" onClick={() => apiRef.current?.zoomBy(1 / 1.3)}>
            −
          </button>
          <button className={styles.zoomBtn} aria-label="Fit to view" title="Fit to view" onClick={() => apiRef.current?.fitToView()}>
            ⤢
          </button>
          <button className={styles.zoomBtn} aria-label="Zoom in" onClick={() => apiRef.current?.zoomBy(1.3)}>
            +
          </button>
        </div>
        <button
          className={`${styles.ctl} ${panMode ? styles.on : ""}`}
          onClick={() => setPanMode((v) => !v)}
          aria-pressed={panMode}
        >
          ✥ Pan
        </button>
        <button
          className={`${styles.ctl} ${labelMode !== "auto" ? styles.on : ""}`}
          onClick={() => setLabelMode((m) => (m === "auto" ? "all" : m === "all" ? "off" : "auto"))}
        >
          Labels: {labelMode === "auto" ? "Auto" : labelMode === "all" ? "All" : "Off"}
        </button>
        <Link className={styles.ctl} href="/gallery" style={{ textDecoration: "none" }}>
          ◫ Gallery
        </Link>
      </div>

      {/* selected-warren preview */}
      {selected ? (
        <aside className={styles.superCard}>
          <div className={styles.superCardField} style={{ color: `oklch(0.78 0.13 ${hueOf(selected.field)})` }}>
            {selected.field}
          </div>
          <h2 className={styles.superCardTitle}>{selected.title}</h2>
          <div className={styles.superCardTrail}>
            <MiniTrail trail={selected.trail} />
          </div>
          <div className={styles.superCardStat}>{selected.size} articles</div>
          <Link className={styles.superCardOpen} href={`/w/${selected.id}`}>
            replay this warren →
          </Link>
        </aside>
      ) : null}
    </div>
  );
}
