"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import styles from "@/app/explore.module.css";
import { hueOf, START_ID } from "@/lib/explore/corpus";
import { placeholder, resolve } from "@/lib/explore/article-store";
import { badgeFor, bridgeFor, titleFor } from "@/lib/explore/narration";
import { fetchBridge, fetchTitle } from "@/lib/explore/api";
import { exportWarrenImage } from "@/lib/explore/exportImage";
import type { WarrenSnapshot } from "@/lib/explore/warren-snapshot";
import ArticlePalette from "./ArticlePalette";
import BurrowCard from "./BurrowCard";
import ForceGraph from "./ForceGraph";
import Starfield from "./Starfield";
import WarrenList from "./WarrenList";
import type { GraphApi, GraphEdge, GraphNode } from "./types";

const DEFAULT_ACCENT = "#e9b44c"; // antique gold (Star Chart spine)
const ACCENT_SWATCHES = ["#e9b44c", "#8aa0ff", "#b58cff", "#5fd9c2", "#ff8fab"];
const STARFIELD = 0.9;
const MOBILE_BP = 880;

type Present = { id: string; depth: number };

/** Brand mark — a trail that dips into the dark and lifts into a bright star. */
function Logo() {
  return (
    <svg className={styles.logo} viewBox="0 0 36 28" width={36} height={28}>
      <line x1={6} y1={21} x2={14} y2={8} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
      <line x1={14} y1={8} x2={24} y2={15} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
      <line x1={24} y1={15} x2={31} y2={6} stroke="currentColor" strokeWidth={1.4} opacity={0.85} />
      <circle cx={6} cy={21} r={2.4} fill="currentColor" />
      <circle cx={14} cy={8} r={3} fill="currentColor" />
      <circle cx={24} cy={15} r={2.4} fill="currentColor" />
      <circle cx={31} cy={6} r={3.4} fill="var(--accent)" />
    </svg>
  );
}

/** A connective-tissue subtitle that fades in like a film subtitle, and out on change. */
function Subtitle({ text }: { text: string }) {
  return (
    <motion.div
      className={styles.subtitle}
      initial={{ opacity: 0, x: "-50%", y: 14 }}
      animate={{ opacity: 1, x: "-50%", y: 0 }}
      exit={{ opacity: 0, x: "-50%", y: 8 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.25, 1] }}
    >
      <span className={styles.subtitleQuote}>{"“"}</span>
      {text}
      <span className={styles.subtitleQuote}>{"”"}</span>
    </motion.div>
  );
}

export default function ExploreMap() {
  // ---- tweakable display state ----
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [showAllLabels, setShowAllLabels] = useState(false);

  // ---- graph state ----
  const [present, setPresent] = useState<Present[]>([{ id: START_ID, depth: 0 }]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [spineIds, setSpineIds] = useState<string[]>([START_ID]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newestId, setNewestId] = useState<string | null>(START_ID);
  const [subtitle, setSubtitle] = useState<{ text: string; key: number } | null>(null);
  const [elapsed, setElapsed] = useState(4);
  const [viewportW, setViewportW] = useState<number>(MOBILE_BP + 1);
  const [listOpen, setListOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // AI auto-titles keyed by "firstId>lastId"; overlays the canned title when present.
  const [aiTitles, setAiTitles] = useState<Record<string, string>>({});

  // lazy init keeps the impure Date.now() out of render (run once on mount)
  const [startedAt] = useState(() => Date.now() - 4 * 60 * 1000);
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GraphApi | null>(null);
  const introDone = useRef(false);
  const subTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentIds = new Set(present.map((p) => p.id));

  const nodes: GraphNode[] = present.map((p) => {
    const a = resolve(p.id) ?? placeholder(p.id);
    return { id: p.id, depth: p.depth, category: a.category, title: a.title };
  });

  const flashSubtitle = useCallback((text: string) => {
    setSubtitle({ text, key: Date.now() });
    if (subTimer.current) clearTimeout(subTimer.current);
    subTimer.current = setTimeout(() => setSubtitle(null), 7000);
  }, []);

  // Refine an edge's bridge with the live AI sentence, then update the edge + (if it's
  // still the active subtitle) the on-screen subtitle. Falls back silently to the canned
  // bridge on any error or when AI is unconfigured — the node already rendered optimistically.
  const refineBridge = useCallback(
    async (fromId: string, toId: string, fallback: string) => {
      const from = resolve(fromId);
      const to = resolve(toId) ?? placeholder(toId);
      if (!from) return;
      try {
        const ai = await fetchBridge(
          { title: from.title, description: from.blurb },
          { title: to.title, description: to.blurb },
        );
        if (!ai || ai === fallback) return;
        setEdges((prev) =>
          prev.map((e) =>
            e.source === fromId && e.target === toId ? { ...e, bridge: ai } : e,
          ),
        );
        // only swap the visible subtitle if it's still showing this hop's fallback
        setSubtitle((s) => (s && s.text === fallback ? { ...s, text: ai } : s));
      } catch {
        // keep the canned bridge — already shown
      }
    },
    [],
  );

  // ---- add a hop ----
  const addHop = useCallback(
    (fromId: string, toId: string, asSpine: boolean) => {
      const bridge = bridgeFor(fromId, toId); // instant, canned — optimistic
      setPresent((prev) => {
        if (prev.find((p) => p.id === toId)) return prev;
        const fromDepth = (prev.find((p) => p.id === fromId) || { depth: 0 }).depth;
        return [...prev, { id: toId, depth: fromDepth + 1 }];
      });
      setEdges((prev) => {
        if (prev.find((e) => e.source === fromId && e.target === toId)) return prev;
        return [...prev, { source: fromId, target: toId, spine: asSpine, bridge }];
      });
      if (asSpine)
        setSpineIds((prev) => (prev[prev.length - 1] === fromId ? [...prev, toId] : prev));
      setNewestId(toId);
      setSelectedId(toId);
      flashSubtitle(bridge);
      // ARIA live announcement for screen readers (a11y plan: announce each new node).
      setAnnounce(`Added ${(resolve(toId) ?? placeholder(toId)).title}. ${bridge}`);
      // then upgrade the canned bridge to the live AI sentence in the background
      void refineBridge(fromId, toId, bridge);
    },
    [flashSubtitle, refineBridge],
  );

  // ---- chip click ----
  const handleChip = useCallback(
    (fromId: string, toId: string, visited: boolean) => {
      if (visited) {
        const bridge = bridgeFor(fromId, toId);
        setEdges((prev) =>
          prev.find((e) => e.source === fromId && e.target === toId)
            ? prev
            : [...prev, { source: fromId, target: toId, spine: false, bridge }],
        );
        setSelectedId(toId);
        setNewestId(null);
        void refineBridge(fromId, toId, bridge);
        return;
      }
      const isSpine = spineIds[spineIds.length - 1] === fromId;
      addHop(fromId, toId, isSpine);
    },
    [spineIds, addHop, refineBridge],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setNewestId(null);
  }, []);

  const handleReady = useCallback((api: GraphApi) => {
    apiRef.current = api;
  }, []);

  // Palette pick: select if already present, else attach as a branch off the current node.
  const jumpTo = useCallback(
    (id: string) => {
      if (presentIds.has(id)) {
        handleSelect(id);
        apiRef.current?.focus(id);
        return;
      }
      const fromId = selectedId ?? spineIds[spineIds.length - 1];
      const isSpine = spineIds[spineIds.length - 1] === fromId;
      addHop(fromId, id, isSpine);
    },
    // presentIds is recomputed each render; spread its membership via present length
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, spineIds, addHop, handleSelect, present.length],
  );

  // ⌘K / Ctrl+K opens the article palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // track viewport width for burrow placement (avoids window access during render)
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- intro autoplay: black-hole → spaghettification → pasta ----
  useEffect(() => {
    const seq: [string, string][] = [
      ["black-hole", "spaghettification"],
      ["spaghettification", "pasta"],
    ];
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const step = () => {
      if (introDone.current) return;
      if (i >= seq.length) {
        setSelectedId("pasta");
        introDone.current = true;
        return;
      }
      const [from, to] = seq[i++];
      addHop(from, to, true);
      timers.push(setTimeout(step, 1500));
    };
    timers.push(setTimeout(step, 900));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipIntro = () => {
    introDone.current = true;
  };

  // elapsed timer
  useEffect(() => {
    const iv = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 60000)),
      15000,
    );
    return () => clearInterval(iv);
  }, [startedAt]);

  // apply accent + starfield to root CSS vars
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  // ---- derived ----
  const selArticle = selectedId ? (resolve(selectedId) ?? placeholder(selectedId)) : null;
  const incomingBridge = (() => {
    if (!selectedId) return null;
    const ins = edges.filter((e) => e.target === selectedId);
    const sp = ins.find((e) => e.spine) || ins[0];
    return sp ? sp.bridge : null;
  })();

  // Canned title is instant; an AI title overlays it when available (keyed by first→last
  // so it re-fetches only when the journey's endpoints change). Falls back to canned.
  const cannedTitle = titleFor(spineIds, (id) => (resolve(id) ?? placeholder(id)).title);
  const titleKey = spineIds.length >= 2 ? `${spineIds[0]}>${spineIds[spineIds.length - 1]}` : "";
  useEffect(() => {
    if (!titleKey) return;
    let cancelled = false;
    const titles = spineIds.map((id) => resolve(id)?.title).filter(Boolean) as string[];
    fetchTitle(titles)
      .then((t) => {
        if (!cancelled && t) setAiTitles((m) => ({ ...m, [titleKey]: t }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleKey]);
  const autoTitle = (titleKey && aiTitles[titleKey]) || cannedTitle;

  const badge = badgeFor(spineIds, nodes.length);
  const hops = Math.max(0, spineIds.length - 1);
  const cats = new Set(nodes.map((n) => n.category)).size;
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const stars = Math.min(5, Math.max(1, maxDepth + 1));

  const isMobile = viewportW < MOBILE_BP;
  const reserveRight = selArticle && !isMobile ? 412 : 0;
  const reserveBottom =
    selArticle && isMobile
      ? Math.round((typeof window !== "undefined" ? window.innerHeight : 700) * 0.52)
      : 0;

  const handleExport = useCallback(() => {
    if (rootRef.current) {
      const slug = autoTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      void exportWarrenImage(rootRef.current, `${slug || "warren"}.png`);
    }
  }, [autoTitle]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const handleShare = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const snapshot: WarrenSnapshot = {
      title: autoTitle,
      spine: spineIds,
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        category: n.category,
        depth: n.depth,
      })),
      edges,
      startedAt,
      stats: { hops, categories: cats, minutes: elapsed, stars },
    };
    try {
      const res = await fetch("/api/warren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.status === 503) {
        flashToast("Sharing needs Supabase keys — saved nothing yet.");
        return;
      }
      if (!res.ok || !data.url) {
        flashToast(data.error ? `Couldn't share: ${data.error}` : "Couldn't share.");
        return;
      }
      const full = `${window.location.origin}${data.url}`;
      try {
        await navigator.clipboard.writeText(full);
        flashToast("Share link copied to clipboard ✦");
      } catch {
        flashToast(`Shared: ${full}`);
      }
    } catch {
      flashToast("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }, [saving, autoTitle, spineIds, nodes, edges, startedAt, hops, cats, elapsed, stars, flashToast]);

  return (
    <div className={styles.root} ref={rootRef} onPointerDownCapture={skipIntro}>
      <Starfield density={STARFIELD} />

      <ForceGraph
        nodes={nodes}
        edges={edges}
        selectedId={selectedId}
        spineIds={spineIds}
        newestId={newestId}
        accent={accent}
        showAllLabels={showAllLabels}
        dimmed={!!selArticle}
        reserveRight={reserveRight}
        reserveBottom={reserveBottom}
        onSelect={handleSelect}
        onReady={handleReady}
      />

      {/* top-left brand + auto-title */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <Logo />
          <div>
            <div className={styles.brandName}>Warren</div>
            <div className={styles.brandTag}>Map your curiosity</div>
          </div>
        </div>
        <div className={styles.titlecard}>
          <div className={styles.tcLabel}>your warren</div>
          <div className={styles.tcTitle}>{autoTitle}</div>
          {badge ? (
            <div className={styles.tcBadge}>
              <span className={styles.tcBadgeGlyph}>{badge.glyph}</span>
              {badge.name}
            </div>
          ) : null}
        </div>
      </header>

      {/* top-right controls */}
      <div className={styles.controls} data-export-hide="true">
        <button className={styles.ctl} onClick={() => apiRef.current?.fitToView()}>
          ⤢ Fit
        </button>
        <button
          className={`${styles.ctl} ${showAllLabels ? styles.on : ""}`}
          onClick={() => setShowAllLabels((v) => !v)}
        >
          Labels
        </button>
        <button className={styles.ctl} onClick={() => setListOpen(true)}>
          ☰ List
        </button>
        <button className={styles.ctl} onClick={() => setPaletteOpen(true)}>
          ⌘K Find
        </button>
        <button className={styles.ctl} onClick={handleExport}>
          ↓ Save
        </button>
        <button className={styles.ctl} onClick={handleShare} disabled={saving}>
          {saving ? "Sharing…" : "↗ Share"}
        </button>
        <Link className={styles.ctl} href="/gallery" style={{ textDecoration: "none" }}>
          ◫ Gallery
        </Link>
        {ACCENT_SWATCHES.map((c) => (
          <button
            key={c}
            className={styles.swatch}
            aria-label={`Accent ${c}`}
            aria-pressed={accent === c}
            onClick={() => setAccent(c)}
            style={{
              background: c,
              borderColor: accent === c ? "var(--ink)" : "var(--line)",
            }}
          />
        ))}
        <span className={styles.ctlHint}>drag to pan · scroll to zoom</span>
      </div>

      {/* spine breadcrumb */}
      <div className={styles.spineRail}>
        {spineIds.map((id, i) => {
          const a = resolve(id) ?? placeholder(id);
          const h = hueOf(a.category);
          return (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              {i > 0 ? <span className={styles.spineLink} /> : null}
              <button
                className={`${styles.spinePill} ${selectedId === id ? styles.active : ""}`}
                style={{ "--cat-h": h } as React.CSSProperties}
                onClick={() => {
                  handleSelect(id);
                  apiRef.current?.focus(id);
                }}
              >
                <span className={styles.spineDot} style={{ background: `oklch(0.72 0.15 ${h})` }} />
                {a.title}
              </button>
            </span>
          );
        })}
      </div>

      {/* stat strip */}
      <div className={styles.statStrip}>
        <div className={styles.stat}>
          <b>{hops}</b> hops
        </div>
        <span className={styles.statSep}>·</span>
        <div className={styles.stat}>
          <b>{cats}</b> categories
        </div>
        <span className={styles.statSep}>·</span>
        <div className={styles.stat}>
          <b>{elapsed}</b> min
        </div>
        <span className={styles.statSep}>·</span>
        <div className={styles.statDive}>
          deepest dive
          <span className={styles.stars}>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`${styles.star} ${i < stars ? styles.starOn : ""}`}>
                ★
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* connective-tissue subtitle */}
      <AnimatePresence mode="wait">
        {subtitle ? <Subtitle key={subtitle.key} text={subtitle.text} /> : null}
      </AnimatePresence>

      {/* burrow card */}
      <AnimatePresence>
        {selArticle ? (
          <BurrowCard
            key={selArticle.id}
            article={selArticle}
            presentIds={presentIds}
            incomingBridge={incomingBridge}
            accent={accent}
            onChip={handleChip}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </AnimatePresence>

      {/* a11y: parallel text-list view + article command palette */}
      <WarrenList
        open={listOpen}
        onOpenChange={setListOpen}
        spineIds={spineIds}
        presentIds={present.map((p) => p.id)}
        edges={edges}
        title={autoTitle}
        onSelect={(id) => {
          handleSelect(id);
          apiRef.current?.focus(id);
        }}
      />
      <ArticlePalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        presentIds={present.map((p) => p.id)}
        onPick={jumpTo}
      />

      {/* toast (share feedback) */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            className={styles.toast}
            data-export-hide="true"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 12, x: "-50%" }}
            transition={{ duration: 0.3 }}
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ARIA live region — announces each new node + its connective sentence */}
      <div aria-live="polite" role="status" className={styles.visuallyHidden}>
        {announce}
      </div>
    </div>
  );
}
