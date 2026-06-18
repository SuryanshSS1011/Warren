"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "@/app/explore.module.css";
import { hueOf, labelOf } from "@/lib/explore/corpus";
import { detailFor, LOD, type GraphEdge, type GraphEngineProps, type GraphNode, type GraphApi } from "./types";

type NodeTileProps = {
  node: GraphNode;
  onSpine: boolean;
  isSel: boolean;
  width: number;
  hue: number;
  labelOn: boolean;
  detail: "tile" | "dot";
  accent: string;
  registerPos: (el: HTMLDivElement | null) => void;
  onDown: (ev: ReactPointerEvent) => void;
};

/** A single article tag/tile. */
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
        style={{
          "--cat-h": hue,
          "--accent": accent,
          width: `${width}px`,
          borderColor: onSpine
            ? `oklch(0.72 0.14 ${hue} / 0.55)`
            : `oklch(0.7 0.06 ${hue} / 0.22)`,
        } as React.CSSProperties}
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

/** 
 * DOM-based Graph Engine using "Tag" style nodes. 
 * Replaces the canvas implementation to restore the requested aesthetic.
 */
const CanvasGraphEngine = forwardRef<GraphApi, GraphEngineProps>((props, ref) => {
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
  const particles = useRef<{ key: string; els: SVGCircleElement[]; from: string; to: string }[]>(
    [],
  );
  const firstFit = useRef(true);
  const propsRef = useRef(props);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const spineSet = new Set(spineIds || []);

  function ensureSim() {
    const s = sim.current;
    const { nodes: ns, edges: es } = propsRef.current;
    ns.forEach((n) => {
      if (!s.has(n.id)) {
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
    Array.from(s.keys()).forEach((id) => {
      if (!ns.find((n) => n.id === id)) s.delete(id);
    });
  }

  function heat(a: number) {
    alpha.current = Math.max(alpha.current, a == null ? 0.9 : a);
  }

  function tick() {
    const s = sim.current;
    const { nodes: ns, edges: es } = propsRef.current;
    const list = ns.map((n) => ({ n, p: s.get(n.id) })).filter((o) => o.p) as {
      n: GraphNode;
      p: SimNode;
    }[];
    const REPEL = 26000;
    const SPRING = 0.04;
    const CENTER = 0.0085;
    const DAMP = 0.82;
    const a = alpha.current;

    if (a > 0.006) {
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
      es.forEach((e) => {
        const A = s.get(e.source);
        const B = s.get(e.target);
        if (!A || !B) return;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const L = e.spine ? 220 : 180;
        const f = SPRING * (d - L) * a;
        const ux = dx / d;
        const uy = dy / d;
        A.vx += ux * f;
        A.vy += uy * f;
        B.vx -= ux * f;
        B.vy -= uy * f;
      });
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

  const focus = useCallback((id: string, opts?: { zoom?: number }) => {
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
  }, []);

  const fitToView = useCallback(() => {
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
  }, []);

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

  const snapCamera = useCallback(() => {
    const c = cam.current;
    c.x = c.tx;
    c.y = c.ty;
    c.zoom = c.tzoom;
    paint();
  }, []);

  function settle(iters: number) {
    alpha.current = 1;
    for (let i = 0; i < (iters || 200); i++) tick();
    alpha.current = 0;
  }

  const gotoFocus = useCallback((id: string) => {
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
  }, [focus, snapCamera]);

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
    else if (firstFit.current) fitToView();
    snapCamera();
    firstFit.current = false;
  }, [nodes.length, edges.length]);

  const api: GraphApi = {
    fitToView: () => {
      fitToView();
      const c = cam.current;
      setTimeout(() => {
        if (Math.abs(c.zoom - c.tzoom) > 0.02 || Math.abs(c.x - c.tx) > 2)
          snapCamera();
      }, 150);
    },
    focus: gotoFocus,
  };

  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    onReady(api);
  }, []);

  useEffect(() => {
    if (selectedId) gotoFocus(selectedId);
  }, [selectedId]);

  function clientToWorld(cx: number, cy: number) {
    const vp = viewportRef.current!.getBoundingClientRect();
    const c = cam.current;
    return { x: (cx - vp.left - c.x) / c.zoom, y: (cy - vp.top - c.y) / c.zoom };
  }

  function onPointerMove(ev: PointerEvent) {
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

  function onPointerUp() {
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

  function onPointerDownBg(ev: ReactPointerEvent) {
    if (ev.button !== 0) return;
    drag.current = {
      mode: "pan",
      sx: ev.clientX,
      sy: ev.clientY,
      ox: cam.current.tx,
      oy: cam.current.ty,
      moved: false,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerDownNode(ev: ReactPointerEvent, id: string) {
    ev.stopPropagation();
    if (ev.button !== 0) return;
    drag.current = { mode: "node", id, sx: ev.clientX, sy: ev.clientY, moved: false };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const c = cam.current;
    const factor = Math.exp(-ev.deltaY * 0.0014);
    const nz = Math.min(2.2, Math.max(0.35, c.tzoom * factor));
    const vp = viewportRef.current!.getBoundingClientRect();
    const mx = ev.clientX - vp.left;
    const my = ev.clientY - vp.top;
    c.tx = mx - (mx - c.tx) * (nz / c.tzoom);
    c.ty = my - (my - c.ty) * (nz / c.tzoom);
    c.tzoom = nz;
  }

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const sizeFor = (n: GraphNode) => Math.max(96, 150 - (n.depth || 0) * 9);

  return (
    <div
      className={`${styles.viewport} ${dimmed ? styles.dimmed : ""}`}
      style={{ position: "absolute", inset: 0, zIndex: 5 }}
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
});

CanvasGraphEngine.displayName = "CanvasGraphEngine";

export default CanvasGraphEngine;
