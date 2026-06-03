"use client";
import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const WarrenGraph = forwardRef(function WarrenGraph({ onNodeClick }, ref) {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  const handleEngineStop = useCallback(() => {
    fgRef.current?.d3Force("charge", null);
  }, []);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setTimeout(() => fgRef.current?.zoomToFit(400, 80), 500);
    }
  }, [graphData.nodes.length]);

  const addNode = useCallback((article, parentId = null) => {
    setGraphData((prev) => {
      if (prev.nodes.find((n) => n.id === article.title)) return prev;

      const newNode = {
        id: article.title,
        label: article.title,
        extract: article.extract,
        description: article.description,
        thumbnail: article.thumbnail,
        url: article.url,
        related: article.related,
        depth: parentId
          ? (prev.nodes.find((n) => n.id === parentId)?.depth ?? 0) + 1
          : 0,
      };

      const newLinks = parentId
        ? [{ source: parentId, target: article.title, spine: true }]
        : [];

      return {
        nodes: [...prev.nodes, newNode],
        links: [...prev.links, ...newLinks],
      };
    });
  }, []);

  // Expose addNode to parent via ref
  useImperativeHandle(ref, () => ({
    addNode,
  }), [addNode]);

  const handleNodeClick = useCallback(
    (node) => {
      fgRef.current?.centerAt(node.x, node.y, 600);
      fgRef.current?.zoom(2.5, 600);
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0f" }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#0a0a0f"
        nodeLabel="label"
        nodeVal={(node) => Math.max(4 - (node.depth ?? 0), 1) * 6}
        nodeColor={() => "#7c3aed"}
        linkColor={(link) => (link.spine ? "#7c3aed" : "#2d2d3a")}
        linkWidth={(link) => (link.spine ? 2 : 1)}
        linkDirectionalParticles={(link) => (link.spine ? 3 : 0)}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        onEngineStop={handleEngineStop}
        cooldownTime={900}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const radius = Math.max(4 - (node.depth ?? 0), 1) * 3;
          ctx.shadowColor = "#7c3aed";
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = "#7c3aed";
          ctx.fill();
          ctx.shadowBlur = 0;
          const fontSize = Math.max(12 / globalScale, 3);
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.textAlign = "center";
          ctx.fillText(node.label, node.x, node.y + radius + 4);
        }}
      />
    </div>
  );
});

export default WarrenGraph;