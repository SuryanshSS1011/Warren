"use client";
import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const INITIAL_DATA = {
  nodes: [
    { id: "black-holes", label: "Black Holes", val: 8 },
    { id: "event-horizon", label: "Event Horizon", val: 5 },
    { id: "spaghettification", label: "Spaghettification", val: 5 },
    { id: "pasta", label: "Pasta", val: 5 },
    { id: "ancient-rome", label: "Ancient Rome", val: 5 },
  ],
  links: [
    { source: "black-holes", target: "event-horizon" },
    { source: "event-horizon", target: "spaghettification" },
    { source: "spaghettification", target: "pasta" },
    { source: "pasta", target: "ancient-rome" },
  ],
};

export default function GraphSpike() {
  const fgRef = useRef();

  const handleEngineStop = useCallback(() => {
    // Kill simulation after settle — prevents nervous graph
    fgRef.current?.d3Force("charge", null);
  }, []);

  useEffect(() => {
    // Auto-zoom to fit after mount
    setTimeout(() => fgRef.current?.zoomToFit(400), 500);
  }, []);

  return (
    <div style={{ background: "#0a0a0f", width: "100vw", height: "100vh" }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={INITIAL_DATA}
        backgroundColor="#0a0a0f"
        nodeLabel="label"
        nodeVal="val"
        nodeColor={() => "#7c3aed"}
        nodeRelSize={6}
        linkColor={() => "#4c1d95"}
        linkWidth={2}
        linkDirectionalParticles={3}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        onEngineStop={handleEngineStop}
        cooldownTime={800}
        nodeCanvasObject={(node, ctx, globalScale) => {
          // Glow effect
          ctx.shadowColor = "#7c3aed";
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = "#7c3aed";
          ctx.fill();
          ctx.shadowBlur = 0;

          // Label
          const label = node.label;
          const fontSize = Math.max(12 / globalScale, 3);
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.textAlign = "center";
          ctx.fillText(label, node.x, node.y + 10);
        }}
      />
    </div>
  );
}