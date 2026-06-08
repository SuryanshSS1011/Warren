"use client";

import { useEffect, useRef } from "react";
import styles from "@/app/explore.module.css";

/** A subtle animated star layer painted on a canvas behind the graph. */
export default function Starfield({ density }: { density: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const densityRef = useRef(density);
  // keep the live density in a ref for the rAF draw loop, updated outside render
  useEffect(() => {
    densityRef.current = density;
  }, [density]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    type Star = {
      x: number;
      y: number;
      r: number;
      base: number;
      tw: number;
      sp: number;
      hue: number;
    };
    let stars: Star[] = [];

    function build() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 7000);
      stars = Array.from({ length: count }).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        base: Math.random() * 0.5 + 0.2,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.8 + 0.3,
        // mostly warm gold/ivory specks with a few cool ones — matches Star Chart
        hue: Math.random() < 0.18 ? 256 : Math.random() < 0.6 ? 70 : 40,
      }));
    }

    function draw(ts: number) {
      const t = ts / 1000;
      const dens = densityRef.current;
      ctx!.clearRect(0, 0, w, h);
      for (const s of stars) {
        const tw = Math.sin(t * s.sp + s.tw) * 0.5 + 0.5;
        const a = s.base * (0.45 + tw * 0.55) * dens;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `oklch(0.92 0.05 ${s.hue} / ${a.toFixed(3)})`;
        ctx!.fill();
        if (s.r > 1.1) {
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, s.r * 2.6, 0, Math.PI * 2);
          ctx!.fillStyle = `oklch(0.85 0.08 ${s.hue} / ${(a * 0.12).toFixed(3)})`;
          ctx!.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    }

    build();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", build);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", build);
    };
  }, []);

  return <canvas className={styles.starfield} ref={canvasRef} />;
}
