"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from "react-force-graph-2d";
import styles from "@/app/explore.module.css";
import { hueOf, labelOf } from "@/lib/explore/hue";
import { detailFor, LOD, type GraphEdge, type GraphEngineProps, type GraphNode } from "./types";

// react-force-graph-2d is canvas/DOM only — it touches `window`/`document` at import time,
// so it MUST NOT server-render. Load it client-only behind next/dynamic.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

// ---- rfg data shapes. We use rfg's DEFAULT-generic shapes so they line up with the
// types the (dynamic-wrapped, generics-erased) ForceGraph2D component actually hands our
// callbacks. Our payload fields (spine/key on links) ride the open `[others]: any` index. ----
type RfgNode = NodeObject;
type RfgLink = LinkObject;
type RfgMethods = ForceGraphMethods;

const edgeKey = (e: GraphEdge) => `${e.source}→${e.target}`;

// ======================================================================
// NodeTile — copied verbatim from ForceGraph.tsx so the glassy tiles,
// spine/context/selected variants, the `.born` birth animation, the LOD
// "dot" collapse, and the keyboard-a11y semantics are byte-for-byte the same.
// ======================================================================

type NodeTileProps = {
  node: GraphNode;
  onSpine: boolean;
  isSel: boolean;
  width: number;
  hue: number;
  /** label always shown (spine/selected, or "all" mode) */
  labelOn: boolean;
  /** context label whose visibility is gated by live zoom ("auto" mode) — rendered but
   *  shown/hidden each frame by paintOverlay via a class, so it reacts to zoom without
   *  a React re-render. */
  gateLabel: boolean;
  /** "dot" collapses the tile to a small node at high node counts (level-of-detail) */
  detail: "tile" | "dot";
  accent: string;
  registerPos: (el: HTMLDivElement | null) => void;
  onActivate: () => void;
};

// Shared a11y attributes that make a node tile a real, keyboard-operable button.
function nodeA11y(node: GraphNode, isSel: boolean, onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `${node.title}. ${node.category}.`,
    "aria-pressed": isSel,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/* A single article tile. Plays its birth animation on mount, then strips the class so a
   frozen-timeline environment still lands on the visible base state. */
function NodeTile({
  node,
  onSpine,
  isSel,
  width,
  hue,
  labelOn,
  gateLabel,
  detail,
  accent,
  registerPos,
  onActivate,
}: NodeTileProps) {
  // render the label whenever it's always-on OR a zoom-gated context label; the gated
  // ones get the `labelGate` class so paintOverlay can show/hide them per frame.
  const showLabel = labelOn || gateLabel;
  const labelGateCls = gateLabel && !labelOn ? styles.labelGate : "";
  const innerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.classList.add(styles.born);
    const t = setTimeout(() => el.classList.remove(styles.born), 780);
    return () => clearTimeout(t);
  }, []);

  // Level-of-detail: at high node counts, non-spine/non-selected nodes collapse to a
  // compact dot (optionally labeled) so the DOM stays light. Spine/selected stay full.
  if (detail === "dot") {
    return (
      <div ref={registerPos} className={styles.nodePos}>
        <div
          ref={innerRef}
          className={`${styles.nodeDot} ${onSpine ? styles.spine : styles.context}`}
          title={node.title}
          style={{ "--cat-h": hue, "--accent": accent } as React.CSSProperties}
          {...nodeA11y(node, isSel, onActivate)}
        >
          <span className={styles.nodeDotMark} style={{ background: `oklch(0.72 0.15 ${hue})` }} />
          {showLabel ? (
            <span className={`${styles.nodeDotLabel} ${labelGateCls}`}>{node.title}</span>
          ) : null}
        </div>
      </div>
    );
  }

  const cls = [
    styles.node,
    onSpine ? styles.spine : styles.context,
    isSel ? styles.selected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={registerPos} className={styles.nodePos}>
      <div
        ref={innerRef}
        className={cls}
        title={node.title}
        style={
          {
            "--cat-h": hue,
            "--accent": accent,
            width: `${width}px`,
            borderColor: onSpine
              ? `oklch(0.72 0.14 ${hue} / 0.55)`
              : `oklch(0.7 0.06 ${hue} / 0.22)`,
          } as React.CSSProperties
        }
        {...nodeA11y(node, isSel, onActivate)}
      >
        <div
          className={styles.thumb}
          style={{ "--cat-h": hue } as React.CSSProperties}
        />
        <div className={styles.body}>
          <div className={styles.cat}>
            <span
              className={styles.dot}
              style={{ background: `oklch(0.72 0.15 ${hue})` }}
            />
            {labelOf(node.category)}
          </div>
          <div
            className={`${styles.title} ${labelOn ? "" : showLabel ? labelGateCls : styles.muted}`}
          >
            {node.title}
          </div>
        </div>
      </div>
    </div>
  );
}

// depth → tile size (copied from ForceGraph)
const sizeFor = (n: GraphNode) => Math.max(96, 150 - (n.depth || 0) * 9);

// ======================================================================
// CanvasGraphEngine — react-force-graph-2d drives physics + camera + pan/zoom +
// edges/particles on its canvas; a DOM overlay paints the NodeTiles, positioned each
// frame from the graph's own screen coordinates. Implements the GraphApi contract.
// ======================================================================

export default function CanvasGraphEngine(props: GraphEngineProps) {
  const {
    nodes,
    edges,
    selectedId,
    spineIds,
    newestId,
    accent,
    labelMode,
    onSelect,
    onReady,
    dimmed,
    panMode,
  } = props;

  const fgRef = useRef<RfgMethods | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const posRefs = useRef(new Map<string, HTMLDivElement>());
  const firstFit = useRef(true);

  // mirror latest props into a ref so the rAF overlay loop + rfg callbacks read live
  // values, not the closure captured on first render. A layout effect (declared first)
  // guarantees this runs before any structural effect below, and never during render.
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const spineSet = useMemo(() => new Set(spineIds || []), [spineIds]);

  // ---- stable rfg graphData: keep node object identity across renders so the engine
  // retains each node's live (x, y, vx, vy) and only NEW nodes get laid out. The registry
  // is a ref but is ONLY mutated inside the layout effect below (never during render).
  const nodeRegistry = useRef(new Map<string, RfgNode>());
  const [graphData, setGraphData] = useState<{ nodes: RfgNode[]; links: RfgLink[] }>(
    () => ({ nodes: [], links: [] }),
  );

  // Rebuild graphData whenever the node/edge SET changes. New nodes spawn near a present
  // parent so they animate in; existing nodes keep their object (and thus their position).
  useLayoutEffect(() => {
    const reg = nodeRegistry.current;
    const ids = new Set(nodes.map((n) => n.id));
    Array.from(reg.keys()).forEach((id) => {
      if (!ids.has(id)) reg.delete(id);
    });
    const rfgNodes: RfgNode[] = nodes.map((n) => {
      let node = reg.get(n.id);
      if (!node) {
        node = { id: n.id };
        const parentEdge = edges.find((e) => e.target === n.id && reg.has(e.source));
        const parent = parentEdge ? reg.get(parentEdge.source) : undefined;
        if (parent && parent.x != null && parent.y != null) {
          const ang = Math.random() * Math.PI * 2;
          node.x = parent.x + Math.cos(ang) * 12;
          node.y = parent.y + Math.sin(ang) * 12;
        }
        reg.set(n.id, node);
      }
      return node;
    });
    const rfgLinks: RfgLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      spine: e.spine,
      key: edgeKey(e),
    }));
    setGraphData({ nodes: rfgNodes, links: rfgLinks });
  }, [nodes, edges]);

  // ---- camera helpers (respect the reserved HUD/burrow bands) ----
  // The VISIBLE sub-rect excludes reserveRight (desktop burrow), reserveBottom (mobile
  // sheet) and reserveTop (mobile HUD). Its center, in SCREEN pixels relative to the full
  // viewport center, is offset by (-rr/2) horizontally and (+(rt-rb)/2) vertically. To put
  // a graph point at the visible-center, centerAt() must target a point shifted the OPPOSITE
  // way in graph space (screen offset ÷ zoom). centerAt(gx,gy) puts (gx,gy) at the full
  // viewport center, so we ADD the screen-offset/zoom to compensate.
  function reserveCenter(graphX: number, graphY: number, zoom: number) {
    const p = propsRef.current;
    const rr = p.reserveRight || 0;
    const rb = p.reserveBottom || 0;
    const rt = p.reserveTop || 0;
    const dxScreen = -rr / 2;
    const dyScreen = (rt - rb) / 2;
    // shift the centerAt target so the point lands in the visible sub-rect's middle
    return { x: graphX - dxScreen / zoom, y: graphY - dyScreen / zoom };
  }

  function focusNode(id: string, opts?: { zoom?: number }) {
    const fg = fgRef.current;
    const node = nodeRegistry.current.get(id);
    if (!fg || !node || node.x == null || node.y == null) return;
    const z = opts?.zoom ?? Math.min(1.15, Math.max(fg.zoom(), 0.95));
    fg.zoom(z, 600);
    const c = reserveCenter(node.x, node.y, z);
    fg.centerAt(c.x, c.y, 600);
  }

  // Manual fit: zoomToFit's single symmetric padding can't account for a one-sided panel
  // (e.g. the 412px desktop burrow on the right), so it shrinks the graph wrong. Instead we
  // compute the node bounds, pick a zoom that fits them in the VISIBLE sub-rect (viewport
  // minus reserves), then centerAt the bounds-center shifted into that sub-rect.
  function fitView() {
    const fg = fgRef.current;
    const el = rootRef.current;
    if (!fg || !el || nodeRegistry.current.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodeRegistry.current.forEach((n) => {
      if (n.x == null || n.y == null) return;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    if (!Number.isFinite(minX)) return;
    const p = propsRef.current;
    const vw = el.clientWidth - (p.reserveRight || 0);
    const vh = el.clientHeight - (p.reserveTop || 0) - (p.reserveBottom || 0);
    const pad = 160; // room for tile size + breathing space, in graph units at z=1
    const bw = maxX - minX + pad;
    const bh = maxY - minY + pad;
    const z = Math.min(1.15, Math.max(0.3, Math.min(vw / bw, vh / bh)));
    fg.zoom(z, 400);
    const c = reserveCenter((minX + maxX) / 2, (minY + maxY) / 2, z);
    fg.centerAt(c.x, c.y, 400);
  }

  // GraphApi.zoomBy — multiply current zoom about the visible-area center (drives +/−).
  function zoomBy(factor: number) {
    const fg = fgRef.current;
    if (!fg) return;
    const cur = fg.zoom();
    const next = Math.min(2.4, Math.max(0.3, cur * factor));
    fg.zoom(next, 300);
  }

  // Zoom about a screen point (keeps the graph point under the cursor fixed). Used by the
  // pinch handler so the gesture zooms toward where the fingers are, not the center.
  function zoomAtScreen(clientX: number, clientY: number, factor: number) {
    const fg = fgRef.current;
    const el = rootRef.current;
    if (!fg || !el) return;
    const cur = fg.zoom();
    const next = Math.min(2.4, Math.max(0.3, cur * factor));
    if (next === cur) return;
    const rect = el.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    // graph point currently under the cursor (before zoom)
    const before = fg.screen2GraphCoords(sx, sy);
    fg.zoom(next, 0);
    // where that same screen point maps after the zoom; shift the camera by the difference
    // so the original graph point lands back under the cursor.
    const after = fg.screen2GraphCoords(sx, sy);
    const center = fg.centerAt();
    fg.centerAt(center.x + (before.x - after.x), center.y + (before.y - after.y), 0);
  }

  // GraphApi.recenter — center the selected/newest node at a comfortable zoom, else fit.
  function recenter() {
    const p = propsRef.current;
    const id = p.selectedId ?? p.newestId;
    if (id && nodeRegistry.current.has(id)) focusNode(id, { zoom: 1 });
    else fitView();
  }

  // ---- DOM overlay sync: translate each tile to the graph's own screen pixel each frame.
  // graph2ScreenCoords(x, y) maps graph space → canvas/screen pixels honoring rfg's live
  // pan + zoom, so the overlay rides the canvas exactly. We also scale tiles by the current
  // zoom about their top-left so they grow/shrink with the graph like the old nodeLayer did.
  function paintOverlay() {
    const fg = fgRef.current;
    const overlay = overlayRef.current;
    if (!fg || !overlay) return;
    const z = fg.zoom();
    // "auto" label mode: reveal zoom-gated context labels once zoomed in past the reveal
    // threshold. One class toggle on the overlay (CSS hides .labelGate when collapsed) —
    // cheap, no per-node React work. "all"/"off" modes don't gate, so this is inert there.
    overlay.classList.toggle(styles.labelsCollapsed, z < LOD.LABEL_REVEAL_ZOOM);
    const reg = nodeRegistry.current;
    posRefs.current.forEach((el, id) => {
      const node = reg.get(id);
      if (!node || node.x == null || node.y == null) {
        el.style.display = "none";
        return;
      }
      const s = fg.graph2ScreenCoords(node.x, node.y);
      el.style.display = "";
      // center the tile on the node, then scale about that center with the graph zoom
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${z})`;
    });
  }

  // rAF synced to the graph: keeps the overlay glued to the canvas during pan/zoom/physics.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      paintOverlay();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- pinch-to-zoom only. rfg's built-in wheel zoom is disabled (enableZoomInteraction
  // =false); here we handle ONLY the trackpad pinch gesture, which the browser delivers as
  // a wheel event with ctrlKey=true on macOS and Windows. Plain scroll is ignored, so the
  // page/graph never zooms by accident. Listener is non-passive so we can preventDefault.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // not a pinch — ignore (plain scroll does nothing)
      e.preventDefault();
      // deltaY<0 = pinch out (zoom in). Scale per notch; clamp to a gentle factor.
      const factor = Math.exp(-e.deltaY * 0.01);
      zoomAtScreen(e.clientX, e.clientY, factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ---- configure the d3 forces so DOM tiles (~150px) get proper spacing, not d3's tiny
  // defaults. Strong repulsion + a link rest-length spread nodes like the old engine.
  // cooldownTime (set on the component) stops the sim so it isn't "nervous" — we do NOT
  // null the charge (that would let nodes collapse on the next reheat).
  const forcesReady = useRef(false);
  function configureForces() {
    const fg = fgRef.current;
    if (!fg) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force("charge") as any;
    if (charge?.strength) charge.strength(-1800).distanceMax(900);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force("link") as any;
    if (link?.distance) link.distance(150).strength(0.25);
    forcesReady.current = true;
  }

  function onEngineStop() {
    if (!forcesReady.current) configureForces();
    paintOverlay();
    if (firstFit.current) {
      firstFit.current = false;
      const id = propsRef.current.newestId;
      if (id && nodeRegistry.current.has(id)) focusNode(id);
      else fitView();
    }
  }

  // when structure grows, reheat so the new node spreads out, then it settles + stops again.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (!forcesReady.current) configureForces();
    if (firstFit.current) return;
    fg.d3ReheatSimulation();
    if (newestId && nodeRegistry.current.has(newestId)) {
      const t = setTimeout(() => focusNode(newestId), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length, newestId]);

  // configure forces once the graph ref + data exist (before the first settle).
  useEffect(() => {
    const t = setTimeout(configureForces, 0);
    return () => clearTimeout(t);
  }, []);

  // hand the imperative camera API to the orchestrator (once).
  useEffect(() => {
    onReady({
      fitToView: fitView,
      focus: (id: string) => focusNode(id),
      zoomBy,
      recenter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // focus selection changes (matches ForceGraph: selecting re-frames the node).
  useEffect(() => {
    if (selectedId && nodeRegistry.current.has(selectedId)) focusNode(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- interaction model: the canvas (rfg) owns hit-testing. DOM tiles stay pointer-through
  // (pointerEvents: none) so every press lands on the canvas. By DEFAULT, drag on a node
  // moves that individual node (enableNodeDrag), a click selects it, and the background does
  // NOT pan. Panning is opt-in: the "Pan" toggle flips enablePanInteraction so drag-anywhere
  // moves the camera. Zoom is pinch-only (see the wheel effect above). Keyboard activation
  // (Enter/Space on a focused tile) routes through onTileActivate directly.
  function onTileActivate(id: string) {
    onSelect(id);
    focusNode(id);
  }

  function onNodeClick(node: RfgNode) {
    if (node.id == null) return;
    onSelect(String(node.id));
    focusNode(String(node.id));
  }

  // invisible-but-clickable hit area: paint a node-sized rect in the rfg-supplied probe
  // color so rfg's pointer layer can hit-test taps, while the visual stays the DOM tile.
  function nodePointerAreaPaint(
    node: RfgNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) {
    if (node.x == null || node.y == null) return;
    const half = 70; // ~ tile half-extent in graph units
    ctx.fillStyle = color;
    ctx.fillRect(node.x - half, node.y - 24, half * 2, 48);
  }

  // edge styling: spine = gold (accent) thick, context = faint; brighten when adjacent
  // to the selected node (the `.adj` highlight in the old SVG layer).
  const linkColor = (link: RfgLink): string => {
    const sel = propsRef.current.selectedId;
    const s = typeof link.source === "object" ? (link.source as RfgNode).id : link.source;
    const t = typeof link.target === "object" ? (link.target as RfgNode).id : link.target;
    const adj = sel != null && (sel === s || sel === t);
    if (link.spine) return propsRef.current.accent;
    return adj ? "rgba(244, 239, 227, 0.22)" : "rgba(244, 239, 227, 0.1)";
  };
  const linkWidth = (link: RfgLink): number => (link.spine ? 2.1 : 1);
  const linkParticles = (link: RfgLink): number => (link.spine ? 3 : 0);

  return (
    <div
      className={`${styles.viewport} ${dimmed ? styles.dimmed : ""}`}
      ref={rootRef}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        // nodes are the DOM overlay — make rfg's own node render invisible while keeping a
        // real pointer hit-area so onNodeClick/drag still fire on the canvas if needed.
        nodeCanvasObject={() => {}}
        nodeCanvasObjectMode={() => "replace"}
        nodePointerAreaPaint={nodePointerAreaPaint}
        onNodeClick={onNodeClick}
        // rfg draws the EDGES + directional PARTICLES on its canvas (fast, smooth).
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2.2}
        linkDirectionalParticleColor={() => propsRef.current.accent}
        // settle-then-stop so the graph isn't "nervous"
        cooldownTime={2500}
        cooldownTicks={Infinity}
        warmupTicks={60}
        d3VelocityDecay={0.3}
        onEngineStop={onEngineStop}
        // keep the overlay glued during interaction
        onZoom={paintOverlay}
        onZoomEnd={paintOverlay}
        // drag moves individual nodes by default; click selects (onNodeClick)
        enableNodeDrag={!panMode}
        // pan only when the Pan toggle is on — otherwise drag-on-background does nothing
        enablePanInteraction={panMode}
        // zoom is pinch-only. Block rfg's WHEEL zoom (so plain scroll never zooms) but keep
        // its native TOUCH pinch on mobile. Desktop trackpad pinch arrives as a ctrl+wheel
        // event, handled by our own wheel effect above.
        enableZoomInteraction={(e: MouseEvent) => e.type !== "wheel"}
      />

      {/* DOM overlay: NodeTiles positioned each frame from graph2ScreenCoords. It sits
          above the canvas; tiles capture their own taps, the rest stays pointer-through so
          rfg keeps handling pan/zoom on the canvas beneath. */}
      <div
        ref={overlayRef}
        className={styles.nodeLayer}
        style={{ pointerEvents: "none", inset: 0, transform: "none" }}
      >
        {nodes.map((n) => {
          const onSpine = spineSet.has(n.id);
          const isSel = selectedId === n.id;
          // Level-of-detail by node count (see types.ts LOD): collapse far nodes to dots.
          const detail = detailFor(nodes.length, { onSpine, isSelected: isSel });
          // Spine/selected are always labeled. Context labels: always in "all" mode, never
          // in "off" mode, and zoom-gated in "auto" mode (shown/hidden by paintOverlay).
          const labelOn = onSpine || isSel || labelMode === "all";
          const gateLabel = !labelOn && labelMode === "auto";
          return (
            <NodeTile
              key={n.id}
              node={n}
              onSpine={onSpine}
              isSel={isSel}
              width={sizeFor(n)}
              hue={hueOf(n.category)}
              labelOn={labelOn}
              gateLabel={gateLabel}
              detail={detail}
              accent={accent}
              registerPos={(el) => {
                // delete the entry on unmount so the overlay loop never touches a stale el.
                if (el) posRefs.current.set(n.id, el);
                else posRefs.current.delete(n.id);
              }}
              onActivate={() => onTileActivate(n.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
