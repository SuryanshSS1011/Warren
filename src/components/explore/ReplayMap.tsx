"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import styles from "@/app/explore.module.css";
import { hueOf } from "@/lib/explore/corpus";
import type { SavedWarren } from "@/lib/explore/warren-snapshot";
import ForceGraph from "./ForceGraph";
import Starfield from "./Starfield";
import type { GraphApi, GraphEdge, GraphNode } from "./types";

const STEP_MS = 1800;

/** Tunnel Cam replay — animates a saved warren back to life: nodes born one by one along
    the spine, edges drawing with particles, bridge sentences fading in like subtitles. */
export default function ReplayMap({ warren }: { warren: SavedWarren }) {
  // Order the spine nodes, then append any branch nodes at the end of the timeline.
  const spineOrder = warren.spine;
  const timeline = useMemo(() => {
    const branchIds = warren.nodes.map((n) => n.id).filter((id) => !spineOrder.includes(id));
    return [...spineOrder, ...branchIds];
  }, [warren.nodes, spineOrder]);

  const [step, setStep] = useState(1); // how many timeline nodes are revealed
  const [playing, setPlaying] = useState(true);
  const apiRef = useRef<GraphApi | null>(null);

  const total = timeline.length;
  const done = step >= total;

  const edgeFor = useCallback(
    (targetId: string): GraphEdge | null =>
      warren.edges.find((e) => e.target === targetId) ?? null,
    [warren.edges],
  );

  // advance the timeline
  useEffect(() => {
    if (!playing || done) return;
    const t = setTimeout(() => setStep((s) => Math.min(total, s + 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, done, step, total]);

  // the bridge subtitle for the most-recently revealed node — derived from step, no effect
  const subtitle = useMemo(() => {
    if (step < 2) return null;
    const e = edgeFor(timeline[step - 1]);
    return e?.bridge ? { text: e.bridge, key: step } : null;
  }, [step, timeline, edgeFor]);

  const revealed = new Set(timeline.slice(0, step));
  const nodes: GraphNode[] = warren.nodes
    .filter((n) => revealed.has(n.id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category as GraphNode["category"],
      depth: n.depth,
    }));
  const edges: GraphEdge[] = warren.edges.filter(
    (e) => revealed.has(e.source) && revealed.has(e.target),
  );
  const newestId = timeline[step - 1] ?? null;
  const spineIds = spineOrder.filter((id) => revealed.has(id));

  const restart = () => {
    setStep(1);
    setPlaying(true);
  };

  return (
    <div className={styles.root}>
      <Starfield density={0.9} />

      <ForceGraph
        nodes={nodes}
        edges={edges}
        selectedId={null}
        spineIds={spineIds}
        newestId={newestId}
        accent="#e9b44c"
        showAllLabels
        dimmed={false}
        reserveRight={0}
        reserveBottom={0}
        onSelect={() => {}}
        onReady={(api) => {
          apiRef.current = api;
        }}
      />

      {/* brand + title */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <svg className={styles.logo} viewBox="0 0 36 28" width={36} height={28}>
            <line x1={6} y1={21} x2={14} y2={8} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
            <line x1={14} y1={8} x2={24} y2={15} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
            <line x1={24} y1={15} x2={31} y2={6} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
            <circle cx={6} cy={21} r={2.4} fill="currentColor" />
            <circle cx={14} cy={8} r={3} fill="currentColor" />
            <circle cx={24} cy={15} r={2.4} fill="currentColor" />
            <circle cx={31} cy={6} r={3.4} fill="var(--accent)" />
          </svg>
          <div>
            <div className={styles.brandName}>Warren</div>
            <div className={styles.brandTag}>Replaying a warren</div>
          </div>
        </div>
        <div className={styles.titlecard}>
          <div className={styles.tcLabel}>now replaying</div>
          <div className={styles.tcTitle}>{warren.title}</div>
        </div>
      </header>

      {/* transport */}
      <div className={styles.controls} data-export-hide="true">
        <button className={styles.ctl} onClick={() => setPlaying((p) => !p)} disabled={done}>
          {done ? "Done" : playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button className={styles.ctl} onClick={restart}>
          ↺ Restart
        </button>
        <button className={styles.ctl} onClick={() => apiRef.current?.fitToView()}>
          ⤢ Fit
        </button>
      </div>

      {/* scrubber: one tick per timeline node */}
      <div className={styles.spineRail}>
        {timeline.map((id, i) => {
          const n = warren.nodes.find((x) => x.id === id);
          if (!n) return null;
          const h = hueOf(n.category);
          const on = i < step;
          return (
            <button
              key={id}
              className={`${styles.spinePill} ${on ? styles.active : ""}`}
              style={{ "--cat-h": h, opacity: on ? 1 : 0.45 } as React.CSSProperties}
              onClick={() => setStep(i + 1)}
            >
              <span className={styles.spineDot} style={{ background: `oklch(0.72 0.15 ${h})` }} />
              {n.title}
            </button>
          );
        })}
      </div>

      {/* stat strip */}
      <div className={styles.statStrip}>
        <div className={styles.stat}>
          <b>{warren.stats.hops}</b> hops
        </div>
        <span className={styles.statSep}>·</span>
        <div className={styles.stat}>
          <b>{warren.stats.categories}</b> categories
        </div>
        <span className={styles.statSep}>·</span>
        <div className={styles.stat}>
          <b>{warren.stats.minutes}</b> min
        </div>
      </div>

      {/* subtitle */}
      <AnimatePresence mode="wait">
        {subtitle ? (
          <motion.div
            key={subtitle.key}
            className={styles.subtitle}
            initial={{ opacity: 0, x: "-50%", y: 14 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%", y: 8 }}
            transition={{ duration: 0.45 }}
          >
            <span className={styles.subtitleQuote}>{"“"}</span>
            {subtitle.text}
            <span className={styles.subtitleQuote}>{"”"}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* end screen */}
      <AnimatePresence>
        {done ? (
          <motion.div
            className={styles.endCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className={styles.endTitle}>{warren.title}</div>
            <div className={styles.endSub}>
              {warren.stats.hops} hops · {warren.stats.categories} categories ·{" "}
              {warren.stats.minutes} min
            </div>
            <div className={styles.endActions}>
              <Link className={styles.endBtnPrimary} href="/">
                Start your own warren →
              </Link>
              <button className={styles.endBtn} onClick={restart}>
                ↺ Replay
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
