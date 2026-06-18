"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "@/app/explore.module.css";
import { ARTICLES, byId, byTitle, hueOf, START_ID, type CategoryName } from "@/lib/explore/corpus";
import { badgeFor, bridgeFor, titleFor } from "@/lib/explore/narration";
import { exportWarrenImage } from "@/lib/explore/exportImage";
import type { WarrenSnapshot } from "@/lib/explore/warren-snapshot";
import ArticlePalette from "./ArticlePalette";
import BurrowCard from "./BurrowCard";
import CanvasGraphEngine from "./CanvasGraphEngine";
import Starfield from "./Starfield";
import WarrenList from "./WarrenList";
import type { GraphApi, GraphEdge, GraphNode } from "./types";
import { addNodeNote } from "./graphUtils";

const DEFAULT_ACCENT = "#e9b44c"; // antique gold (Star Chart spine)
const ACCENT_SWATCHES = ["#e9b44c", "#8aa0ff", "#b58cff", "#5fd9c2", "#ff8fab"];
const STARFIELD = 0.9;
const MOBILE_BP = 880;
const STORAGE_KEY = "warren_current_state_v2";

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
  const searchParams = useSearchParams();
  const startParam = searchParams.get("start");

  // ---- tweakable display state ----
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [showAllLabels, setShowAllLabels] = useState(false);

  // ---- graph state ----
  const [present, setPresent] = useState<Present[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [spineIds, setSpineIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newestId, setNewestId] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<{ text: string; key: number } | null>(null);
  const [elapsed, setElapsed] = useState(4);
  const [viewportW, setViewportW] = useState<number>(MOBILE_BP + 1);
  const [listOpen, setListOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"burrow" | "wikipedia">("burrow");
  const [enrichedData, setEnrichedData] = useState<Record<string, { title: string; category: CategoryName }>>({});
  const [hasHydrated, setHasHydrated] = useState(false);

  // ---- Persistence & Initialization ----

  // 1. Hydrate from localStorage once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && !startParam) {
        const data = JSON.parse(saved);
        if (data.present) setPresent(data.present);
        if (data.edges) setEdges(data.edges);
        if (data.spineIds) setSpineIds(data.spineIds);
        if (data.enrichedData) setEnrichedData(data.enrichedData);
      }
    } catch (e) {
      console.error("Failed to load warren state", e);
    }
    setHasHydrated(true);
  }, [startParam]);

  // 2. Initialize fresh if nothing was hydrated or if startParam is provided
  useEffect(() => {
    if (!hasHydrated) return;

    const initialId = (() => {
      if (!startParam) return START_ID;
      const found = ARTICLES.find((a) => a.title.toLowerCase() === startParam.toLowerCase());
      return found ? found.id : startParam;
    })();

    // Initialize only if empty OR if we're forced to a new start that isn't in our current map
    if (present.length === 0 || (startParam && !present.find(p => p.id === initialId))) {
      if (startParam && !present.find(p => p.id === initialId)) {
        setPresent([{ id: initialId, depth: 0 }]);
        setSpineIds([initialId]);
        setEdges([]);
        setSelectedId(initialId);
        setNewestId(initialId);
      } else if (present.length === 0) {
        setPresent([{ id: initialId, depth: 0 }]);
        setSpineIds([initialId]);
        setSelectedId(null);
        setNewestId(initialId);
      }
    }
  }, [startParam, hasHydrated]); 

  // 3. Save to localStorage on change
  useEffect(() => {
    if (hasHydrated && present.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        present,
        edges,
        spineIds,
        enrichedData
      }));
    }
  }, [present, edges, spineIds, enrichedData, hasHydrated]);

  // lazy init keeps the impure Date.now() out of render (run once on mount)
  const [startedAt] = useState(() => Date.now() - 4 * 60 * 1000);
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GraphApi | null>(null);
  const introDone = useRef(false);
  const subTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- utility functions ----

  const resolveId = useCallback((idOrTitle: string) => {
    const corpusId = byTitle[idOrTitle]?.id;
    if (corpusId) return corpusId;
    
    // Check if any enriched node has this as its canonical title
    const enrichedId = Object.entries(enrichedData).find(
      ([id, data]) => data.title === idOrTitle
    )?.[0];
    
    return enrichedId || idOrTitle;
  }, [enrichedData]);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const flashSubtitle = useCallback((text: string) => {
    setSubtitle({ text, key: Date.now() });
    if (subTimer.current) clearTimeout(subTimer.current);
    subTimer.current = setTimeout(() => setSubtitle(null), 7000);
  }, []);

  // ---- derived state (no handlers) ----

  const presentIds = new Set(present.map((p) => p.id));

  const nodes: GraphNode[] = present.map((p) => {
    const enriched = enrichedData[p.id];
    const a = byId[p.id] || { 
      id: p.id, 
      title: enriched?.title || p.id, 
      category: enriched?.category || ("Physics" as CategoryName),
      blurb: "Live Wikipedia article",
      extract: "Loading from Wikipedia...",
      links: []
    };
    return { 
      id: p.id, 
      depth: p.depth, 
      category: a.category as CategoryName, 
      title: a.title,
      researchNotes: (enriched as any)?.researchNotes || []
    };
  });

  // ---- derived ----

  const selArticle = useMemo(() => {
    if (!selectedId) return null;

    const base = byId[selectedId] || {
      id: selectedId,
      title: enrichedData[selectedId]?.title || selectedId,
      category: enrichedData[selectedId]?.category || ("Physics" as CategoryName),
      blurb: "Live Wikipedia article",
      extract: "Loading from Wikipedia...",
      links: []
    };

    return {
      ...base,
      researchNotes: (enrichedData[selectedId] as any)?.researchNotes || []
    };
  }, [selectedId, enrichedData]);

  const selectedPathTitles = useMemo(() => {
    if (!selectedId) return [];
    
    // Find the path from the root to the selected node.
    // In our graph, the spine represents the main path. 
    // If the node is on the spine, we use the spine up to that point.
    // If the node is a leaf connected to a spine node, we use the spine up to that connection + the node.
    
    const spineIndex = spineIds.indexOf(selectedId);
    if (spineIndex !== -1) {
      const pathIds = spineIds.slice(0, spineIndex + 1);
      return pathIds.map(id => enrichedData[id]?.title || byId[id]?.title || id);
    }

    // Node is not on spine. Find if it's connected to any spine node.
    const parentEdge = edges.find(e => e.target === selectedId);
    if (parentEdge) {
      const parentSpineIndex = spineIds.indexOf(parentEdge.source);
      if (parentSpineIndex !== -1) {
        const pathIds = [...spineIds.slice(0, parentSpineIndex + 1), selectedId];
        return pathIds.map(id => enrichedData[id]?.title || byId[id]?.title || id);
      }
    }

    // Fallback: just use the spine + this node if they aren't connected (shouldn't happen in normal flow)
    return [...spineIds, selectedId].map(id => enrichedData[id]?.title || byId[id]?.title || id);
  }, [selectedId, spineIds, enrichedData, edges]);

  const incomingBridge = (() => {
    if (!selectedId) return null;
    const ins = edges.filter((e) => e.target === selectedId);
    const sp = ins.find((e) => e.spine) || ins[0];
    return sp ? sp.bridge : null;
  })();

  const autoTitle = titleFor(spineIds);
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

  // ---- handlers (can use utilities and derived state) ----

  const spawnNode = useCallback((rawId: string) => {
    const id = resolveId(rawId);
    setPresent((prev) => {
      if (prev.find((p) => p.id === id)) return prev;
      return [...prev, { id, depth: 0 }];
    });
    setSelectedId(id);
    setNewestId(id);
  }, [resolveId]);

  const addHop = useCallback(
    (rawFrom: string, rawTo: string, asSpine: boolean) => {
      const fromId = resolveId(rawFrom);
      const toId = resolveId(rawTo);

      setPresent((prev) => {
        let next = prev;
        // If the starting node isn't in the map yet, add it as a new root
        if (!prev.find((p) => p.id === fromId)) {
          next = [...next, { id: fromId, depth: 0 }];
        }
        // Add the target node if missing
        if (!next.find((p) => p.id === toId)) {
          const fromDepth = (next.find((p) => p.id === fromId) || { depth: 0 }).depth;
          next = [...next, { id: toId, depth: fromDepth + 1 }];
        }
        return next;
      });
      setEdges((prev) => {
        if (prev.find((e) => e.source === fromId && e.target === toId)) return prev;
        return [...prev, { source: fromId, target: toId, spine: asSpine, bridge: bridgeFor(fromId, toId) }];
      });
      if (asSpine)
        setSpineIds((prev) => (prev[prev.length - 1] === fromId ? [...prev, toId] : prev));
      setNewestId(toId);
      setSelectedId(toId);
      const bridge = bridgeFor(fromId, toId);
      flashSubtitle(bridge);
      // ARIA live announcement for screen readers (a11y plan: announce each new node).
      const title = enrichedData[toId]?.title || byId[toId]?.title || toId;
      setAnnounce(`Added ${title}. ${bridge}`);
    },
    [flashSubtitle, enrichedData, resolveId],
  );

  const handleChip = useCallback(
    (rawFrom: string, rawTo: string, visited: boolean) => {
      const fromId = resolveId(rawFrom);
      const toId = resolveId(rawTo);

      if (visited) {
        setEdges((prev) =>
          prev.find((e) => e.source === fromId && e.target === toId)
            ? prev
            : [...prev, { source: fromId, target: toId, spine: false, bridge: bridgeFor(fromId, toId) }],
        );
        setSelectedId(toId);
        setNewestId(null);
        return;
      }
      const isSpine = spineIds[spineIds.length - 1] === fromId;
      addHop(fromId, toId, isSpine);
    },
    [spineIds, addHop, resolveId],
  );

  const handleSelect = useCallback((rawId: string) => {
    const id = resolveId(rawId);
    setSelectedId(id);
    setNewestId(null);
  }, [resolveId]);

  const handleReady = useCallback((api: GraphApi) => {
    apiRef.current = api;
  }, []);

  const jumpTo = useCallback(
    (rawId: string) => {
      const id = resolveId(rawId);
      if (presentIds.has(id)) {
        handleSelect(id);
        apiRef.current?.focus(id);
        return;
      }
      const fromId = selectedId ?? spineIds[spineIds.length - 1];
      const isSpine = spineIds[spineIds.length - 1] === fromId;
      addHop(fromId, id, isSpine);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, spineIds, addHop, handleSelect, present.length, resolveId],
  );

  const handleEnrich = useCallback((id: string, data: { title: string; category: CategoryName }) => {
    setEnrichedData((prev) => {
      if (prev[id]?.title === data.title && prev[id]?.category === data.category) return prev;
      return { ...prev, [id]: data };
    });
  }, []);

  const handleHighlight = useCallback((nodeId: string, text: string) => {
    setEnrichedData((prev) => {
      const data = prev[nodeId] || { title: nodeId, category: "Physics" };
      const notes = (data as any).researchNotes || [];
      if (notes.includes(text)) return prev;
      
      flashToast("Highlight saved to star ✦");
      
      return {
        ...prev,
        [nodeId]: {
          ...data,
          researchNotes: [...notes, text]
        }
      };
    });
  }, [flashToast]);

  const handleExport = useCallback(() => {
    if (rootRef.current) {
      const slug = autoTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      void exportWarrenImage(rootRef.current, `${slug || "warren"}.png`);
    }
  }, [autoTitle]);

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
        researchNotes: n.researchNotes,
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

  const skipIntro = () => {
    introDone.current = true;
  };

  // ---- effects ----

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

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (startParam) {
      introDone.current = true;
      return;
    }
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

  useEffect(() => {
    const iv = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 60000)),
      15000,
    );
    return () => clearInterval(iv);
  }, [startedAt]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  useEffect(() => {
    const eventSource = new EventSource("/api/extension/hop");
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "WIKI_PAGE_LOAD") {
        const id = resolveId(data.title);
        if (presentIds.has(id)) {
          handleSelect(id);
          apiRef.current?.focus(id);
        } else {
          spawnNode(data.title);
        }
      } else if (data.type === "WIKI_HOP") {
        addHop(data.from, data.to, true);
      }
    };
    return () => eventSource.close();
  }, [addHop, handleSelect, spawnNode, resolveId, presentIds]);

  return (
    <div className={styles.root} ref={rootRef} onPointerDownCapture={skipIntro}>
      <Starfield density={STARFIELD} />

      <CanvasGraphEngine
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
            className={styles.ctl}
            aria-label={`Accent ${c}`}
            onClick={() => setAccent(c)}
            style={{
              width: 22,
              height: 22,
              padding: 0,
              borderRadius: 8,
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
          const enriched = enrichedData[id];
          const a = byId[id] || { title: enriched?.title || id, category: enriched?.category || "Physics" };
          const h = hueOf(a.category as CategoryName);
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
            path={selectedPathTitles}
            incomingBridge={incomingBridge}
            accent={accent}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onChip={handleChip}
            onClose={() => setSelectedId(null)}
            onEnrich={handleEnrich}
            onHighlight={handleHighlight}
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
