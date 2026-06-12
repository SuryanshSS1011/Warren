"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "@/app/explore.module.css";
import { hueOf, labelOf } from "@/lib/explore/corpus";
import { detailFor, LOD, type GraphEdge, type GraphEngineProps, type GraphNode } from "./types";

// The DOM-tile implementation of the graph engine seam. Must satisfy GraphEngineProps so
// a future canvas engine can drop in unchanged (see types.ts and the migration task).
type ForceGraphProps = GraphEngineProps;

type NodeTileProps = {
  node: GraphNode;
  onSpine: boolean;
  isSel: boolean;
  width: number;
  hue: number;
  labelOn: boolean;
  /** "dot" collapses the tile to a small node at high node counts (level-of-detail) */
  detail: "tile" | "dot";
  accent: string;
  registerPos: (el: HTMLDivElement | null) => void;
  onDown: (ev: ReactPointerEvent) => void;
};

/* A single article tile. Plays its birth animation on mount, then strips the class so a
   frozen-timeline environment still lands on the visible base state. */
function NodeTile({
  node,
  onSpine,
  isSel,
  width,
  hue,
  labelOn,
  detail,
  accent,
  registerPos,
  onDown,
}: NodeTileProps) {
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
      <div ref={registerPos} className={styles.nodePos} onPointerDown={onDown}>
        <div
          ref={innerRef}
          className={`${styles.nodeDot} ${onSpine ? styles.spine : styles.context}`}
          title={node.title}
          style={{ "--cat-h": hue, "--accent": accent } as React.CSSProperties}
        >
          <span className={styles.nodeDotMark} style={{ background: `oklch(0.72 0.15 ${hue})` }} />
          {labelOn ? <span className={styles.nodeDotLabel}>{node.title}</span> : null}
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
    <div ref={registerPos} className={styles.nodePos} onPointerDown={onDown}>
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
          <div className={`${styles.title} ${labelOn ? "" : styles.muted}`}>
            {node.title}
          </div>
        </div>
      </div>
    </div>
  );
}

type SimNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
};

type Camera = {
  x: number;
  y: number;
  zoom: number;
  tx: number;
  ty: number;
  tzoom: number;
};

type DragState =
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { mode: "node"; id: string; sx: number; sy: number; moved: boolean }
  | null;

const edgeKey = (e: GraphEdge) => `${e.source}→${e.target}`;

/** DOM tile nodes over an SVG edge layer, driven by a hand-rolled force simulation.
    Physics pre-settles synchronously on each structural change (robust without rAF) and
    rAF is used purely for live motion + camera lerp, with a setTimeout snap fallback. */
export default function ForceGraph(props: ForceGraphProps) {
  const {
    nodes,
    edges,
    selectedId,
    spineIds,
    newestId,
    accent,
    showAllLabels,
    onSelect,
    onReady,
    dimmed,
  } = props;

  const viewportRef = useRef<HTMLDivElement>(null);
  const nodeLayerRef = useRef<HTMLDivElement>(null);
  const edgeGRef = useRef<SVGGElement>(null);
  const posRefs = useRef(new Map<string, HTMLDivElement>());
  const lineRefs = useRef(new Map<string, SVGLineElement>());
  const sim = useRef(new Map<string, SimNode>());
  const cam = useRef<Camera>({ x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tzoom: 1 });
  const alpha = useRef(1);
  const drag = useRef<DragState>(null);
  // active pointers (for multi-touch pinch-zoom) + the in-progress pinch gesture
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const particles = useRef<{ key: string; els: SVGCircleElement[]; from: string; to: string }[]>(
    [],
  );
  const firstFit = useRef(true);
  const propsRef = useRef(props);
  // mirror latest props into a ref so the rAF loop + physics read live values, not the
  // closure captured on first render. A layout effect (declared first) guarantees this
  // runs before the structural settle effect below, and never during render.
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const spineSet = new Set(spineIds || []);

  // ---- ensure a sim node exists for every graph node ----
  function ensureSim() {
    const s = sim.current;
    const { nodes: ns, edges: es } = propsRef.current;
    ns.forEach((n) => {
      if (!s.has(n.id)) {
        // spawn near parent (an edge whose target is this node), else center
        let px = 0;
        let py = 0;
        const parentEdge = es.find((e) => e.target === n.id && s.has(e.source));
        if (parentEdge) {
          const p = s.get(parentEdge.source)!;
          const ang = Math.random() * Math.PI * 2;
          px = p.x + Math.cos(ang) * 12;
          py = p.y + Math.sin(ang) * 12;
        } else {
          px = (Math.random() - 0.5) * 40;
          py = (Math.random() - 0.5) * 40;
        }
        s.set(n.id, { x: px, y: py, vx: 0, vy: 0, fx: null, fy: null });
      }
    });
    // prune removed
    Array.from(s.keys()).forEach((id) => {
      if (!ns.find((n) => n.id === id)) s.delete(id);
    });
  }

  function heat(a: number) {
    alpha.current = Math.max(alpha.current, a == null ? 0.9 : a);
  }

  // ---- physics tick ----
  function tick() {
    const s = sim.current;
    const { nodes: ns, edges: es } = propsRef.current;
    const list = ns.map((n) => ({ n, p: s.get(n.id) })).filter((o) => o.p) as {
      n: GraphNode;
      p: SimNode;
    }[];
    const REPEL = 22000;
    const SPRING = 0.04;
    const CENTER = 0.0085;
    const DAMP = 0.82;
    const a = alpha.current;

    if (a > 0.006) {
      // repulsion (O(n^2), tiny n)
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const A = list[i].p;
          const B = list[j].p;
          let dx = A.x - B.x;
          let dy = A.y - B.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            d2 = 1;
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
          }
          const d = Math.sqrt(d2);
          const f = (REPEL / d2) * a;
          const ux = dx / d;
          const uy = dy / d;
          A.vx += ux * f * 0.5;
          A.vy += uy * f * 0.5;
          B.vx -= ux * f * 0.5;
          B.vy -= uy * f * 0.5;
        }
      }
      // link springs
      es.forEach((e) => {
        const A = s.get(e.source);
        const B = s.get(e.target);
        if (!A || !B) return;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const L = e.spine ? 200 : 168;
        const f = SPRING * (d - L) * a;
        const ux = dx / d;
        const uy = dy / d;
        A.vx += ux * f;
        A.vy += uy * f;
        B.vx -= ux * f;
        B.vy -= uy * f;
      });
      // centering + integrate
      list.forEach(({ p }) => {
        p.vx -= p.x * CENTER * a;
        p.vy -= p.y * CENTER * a;
        if (p.fx != null) {
          p.x = p.fx;
          p.vx = 0;
        } else {
          p.vx *= DAMP;
          p.x += p.vx;
        }
        if (p.fy != null) {
          p.y = p.fy;
          p.vy = 0;
        } else {
          p.vy *= DAMP;
          p.y += p.vy;
        }
      });
      alpha.current *= 0.985;
      if (alpha.current < 0.006) alpha.current = 0;
    }
  }

  // ---- camera ----
  function focus(id: string, opts?: { zoom?: number }) {
    const p = sim.current.get(id);
    if (!p) return;
    const vp = viewportRef.current;
    const w = vp ? vp.clientWidth : 1200;
    const h = vp ? vp.clientHeight : 800;
    const c = cam.current;
    c.tzoom = opts?.zoom || Math.min(1.15, Math.max(c.zoom, 0.95));
    const rr = propsRef.current.reserveRight || 0;
    const rb = propsRef.current.reserveBottom || 0;
    c.tx = (w - rr) / 2 - p.x * c.tzoom;
    c.ty = (h - rb) / 2 - p.y * c.tzoom;
  }

  function fitToView() {
    const s = sim.current;
    if (s.size === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    s.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    const vp = viewportRef.current;
    const w = vp ? vp.clientWidth : 1200;
    const h = vp ? vp.clientHeight : 800;
    const rr = propsRef.current.reserveRight || 0;
    const rb = propsRef.current.reserveBottom || 0;
    const availW = w - rr;
    const availH = h - rb;
    const pad = 220;
    const bw = maxX - minX + pad;
    const bh = maxY - minY + pad;
    const z = Math.min(1.15, Math.max(0.38, Math.min(availW / bw, availH / bh)));
    const c = cam.current;
    c.tzoom = z;
    c.tx = availW / 2 - ((minX + maxX) / 2) * z;
    c.ty = availH / 2 - ((minY + maxY) / 2) * z;
  }

  // ---- render frame ----
  function paint() {
    const c = cam.current;
    c.x += (c.tx - c.x) * 0.12;
    c.y += (c.ty - c.y) * 0.12;
    c.zoom += (c.tzoom - c.zoom) * 0.12;
    const tf = `translate(${c.x}px,${c.y}px) scale(${c.zoom})`;
    if (nodeLayerRef.current) nodeLayerRef.current.style.transform = tf;
    if (edgeGRef.current)
      edgeGRef.current.setAttribute(
        "transform",
        `translate(${c.x} ${c.y}) scale(${c.zoom})`,
      );

    const s = sim.current;
    posRefs.current.forEach((el, id) => {
      const p = s.get(id);
      if (p && el)
        el.style.transform = `translate(calc(${p.x}px - 50%), calc(${p.y}px - 50%))`;
    });
    propsRef.current.edges.forEach((e) => {
      const A = s.get(e.source);
      const B = s.get(e.target);
      const ln = lineRefs.current.get(edgeKey(e));
      if (A && B && ln) {
        ln.setAttribute("x1", String(A.x));
        ln.setAttribute("y1", String(A.y));
        ln.setAttribute("x2", String(B.x));
        ln.setAttribute("y2", String(B.y));
      }
    });
    // particles travel along spine edges
    const t = performance.now() / 1000;
    particles.current.forEach((pt) => {
      const A = s.get(pt.from);
      const B = s.get(pt.to);
      if (!A || !B) return;
      pt.els.forEach((el, i) => {
        const phase = (t * 0.45 + i / pt.els.length) % 1;
        el.setAttribute("cx", String(A.x + (B.x - A.x) * phase));
        el.setAttribute("cy", String(A.y + (B.y - A.y) * phase));
        const fade = Math.sin(phase * Math.PI);
        el.setAttribute("opacity", String(0.15 + fade * 0.65));
      });
    });
  }

  function snapCamera() {
    const c = cam.current;
    c.x = c.tx;
    c.y = c.ty;
    c.zoom = c.tzoom;
    paint();
  }

  // run the simulation synchronously to a resting state (robust without rAF)
  function settle(iters: number) {
    alpha.current = 1;
    for (let i = 0; i < (iters || 200); i++) tick();
    alpha.current = 0;
  }

  // move camera to a node; lerps when rAF is alive, snaps as a fallback
  function gotoFocus(id: string) {
    focus(id);
    const c = cam.current;
    setTimeout(() => {
      if (
        Math.abs(c.x - c.tx) > 2 ||
        Math.abs(c.y - c.ty) > 2 ||
        Math.abs(c.zoom - c.tzoom) > 0.02
      )
        snapCamera();
    }, 150);
  }

  // ---- main loop ----
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tick();
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
     
  }, []);

  // when graph structure changes: ensure sim, settle, rebuild particles, focus newest
  useLayoutEffect(() => {
    ensureSim();
    settle(firstFit.current ? 240 : 200);
    particles.current = edges
      .filter((e) => e.spine)
      .map((e) => {
        const g = edgeGRef.current;
        const key = edgeKey(e);
        const els: SVGCircleElement[] = [];
        if (g) {
          let holder = g.querySelector<SVGGElement>(`[data-pk="${key}"]`);
          if (!holder) {
            holder = document.createElementNS("http://www.w3.org/2000/svg", "g");
            holder.setAttribute("data-pk", key);
            g.appendChild(holder);
          }
          holder.innerHTML = "";
          for (let i = 0; i < 3; i++) {
            const cc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            cc.setAttribute("r", "2.2");
            cc.setAttribute("fill", propsRef.current.accent);
            holder.appendChild(cc);
            els.push(cc);
          }
        }
        return { key, els, from: e.source, to: e.target };
      });
    if (newestId) focus(newestId);
    else fitToView();
    snapCamera();
    firstFit.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  useEffect(() => {
    onReady({
      fitToView: () => {
        fitToView();
        const c = cam.current;
        setTimeout(() => {
          if (Math.abs(c.zoom - c.tzoom) > 0.02 || Math.abs(c.x - c.tx) > 2)
            snapCamera();
        }, 150);
      },
      focus: gotoFocus,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // focus selection changes
  useEffect(() => {
    if (selectedId) gotoFocus(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---- pointer interaction ----
  function clientToWorld(cx: number, cy: number) {
    const vp = viewportRef.current!.getBoundingClientRect();
    const c = cam.current;
    return { x: (cx - vp.left - c.x) / c.zoom, y: (cy - vp.top - c.y) / c.zoom };
  }

  // ---- zoom around a screen point (shared by wheel + pinch) ----
  function zoomAt(screenX: number, screenY: number, factor: number) {
    const c = cam.current;
    const nz = Math.min(2.4, Math.max(0.3, c.tzoom * factor));
    const vp = viewportRef.current!.getBoundingClientRect();
    const mx = screenX - vp.left;
    const my = screenY - vp.top;
    c.tx = mx - (mx - c.tx) * (nz / c.tzoom);
    c.ty = my - (my - c.ty) * (nz / c.tzoom);
    c.zoom += (nz - c.zoom) * 0; // leave lerp to paint()
    c.tzoom = nz;
  }

  function onPointerMove(ev: PointerEvent) {
    // keep the live position for any tracked pointer (used by pinch)
    if (pointers.current.has(ev.pointerId)) {
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    }

    // two fingers down → pinch-zoom around the midpoint (overrides pan)
    if (pointers.current.size >= 2) {
      const pts = Array.from(pointers.current.values());
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const pp = pinch.current;
      if (pp) {
        zoomAt(midX, midY, dist / pp.dist);
        // also pan to follow the midpoint so the gesture feels anchored
        cam.current.tx += midX - pp.midX;
        cam.current.ty += midY - pp.midY;
        cam.current.x = cam.current.tx;
        cam.current.y = cam.current.ty;
      }
      pinch.current = { dist, midX, midY };
      if (drag.current) drag.current.moved = true;
      return;
    }

    const d = drag.current;
    if (!d) return;
    const dist = Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy);
    if (dist > 4) d.moved = true;
    if (d.mode === "pan") {
      cam.current.tx = d.ox + (ev.clientX - d.sx);
      cam.current.ty = d.oy + (ev.clientY - d.sy);
      cam.current.x = cam.current.tx;
      cam.current.y = cam.current.ty;
    } else if (d.mode === "node") {
      const w = clientToWorld(ev.clientX, ev.clientY);
      const p = sim.current.get(d.id);
      if (p) {
        p.fx = w.x;
        p.fy = w.y;
      }
      heat(0.5);
    }
  }

  function onPointerUp(ev: PointerEvent) {
    pointers.current.delete(ev.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0) return; // still mid-gesture
    const d = drag.current;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (d && d.mode === "node") {
      const p = sim.current.get(d.id);
      if (p) {
        p.fx = null;
        p.fy = null;
      }
      if (!d.moved) onSelect(d.id);
      heat(0.3);
    }
    drag.current = null;
  }

  function trackPointer(ev: ReactPointerEvent) {
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerDownBg(ev: ReactPointerEvent) {
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    trackPointer(ev);
    drag.current = {
      mode: "pan",
      sx: ev.clientX,
      sy: ev.clientY,
      ox: cam.current.tx,
      oy: cam.current.ty,
      moved: false,
    };
  }

  function onPointerDownNode(ev: ReactPointerEvent, id: string) {
    ev.stopPropagation();
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    trackPointer(ev);
    drag.current = { mode: "node", id, sx: ev.clientX, sy: ev.clientY, moved: false };
  }

  function onWheel(ev: WheelEvent) {
    ev.preventDefault();
    zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0014));
  }

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // depth → size
  const sizeFor = (n: GraphNode) => Math.max(96, 150 - (n.depth || 0) * 9);

  return (
    <div
      className={`${styles.viewport} ${dimmed ? styles.dimmed : ""}`}
      ref={viewportRef}
      onPointerDown={onPointerDownBg}
    >
      <svg className={styles.edgeLayer}>
        <g ref={edgeGRef}>
          {edges.map((e) => {
            const adj = selectedId === e.source || selectedId === e.target;
            const cls = [styles.edge, e.spine ? styles.spine : "", adj ? styles.adj : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <line
                key={edgeKey(e)}
                ref={(el) => {
                  if (el) lineRefs.current.set(edgeKey(e), el);
                  else lineRefs.current.delete(edgeKey(e));
                }}
                className={cls}
                style={e.spine ? { stroke: accent } : undefined}
              />
            );
          })}
        </g>
      </svg>
      <div className={styles.nodeLayer} ref={nodeLayerRef}>
        {nodes.map((n) => {
          const onSpine = spineSet.has(n.id);
          const isSel = selectedId === n.id;
          // Level-of-detail by node count (see types.ts LOD): collapse far nodes to dots,
          // and force-hide non-spine labels once the graph is dense.
          const detail = detailFor(nodes.length, { onSpine, isSelected: isSel });
          const dense = nodes.length > LOD.FORCE_HIDE_LABELS_AT;
          const labelOn = onSpine || isSel || (showAllLabels && !dense);
          return (
            <NodeTile
              key={n.id}
              node={n}
              onSpine={onSpine}
              isSel={isSel}
              width={sizeFor(n)}
              hue={hueOf(n.category)}
              labelOn={labelOn}
              detail={detail}
              accent={accent}
              registerPos={(el) => {
                // delete the entry on unmount so paint() never iterates a stale element
                if (el) posRefs.current.set(n.id, el);
                else posRefs.current.delete(n.id);
              }}
              onDown={(ev) => onPointerDownNode(ev, n.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
