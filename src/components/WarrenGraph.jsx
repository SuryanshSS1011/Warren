"use client";
import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const WarrenGraph = forwardRef(function WarrenGraph({ onNodeClick }, ref) {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [hoverNode, setHoverNode] = useState(null);

  const handleEngineStop = useCallback(() => {
    // Engine stopped naturally after cooldownTime
  }, []);

  useEffect(() => {
    if (graphData.nodes.length > 0) {
      // Smooth camera pan to new node handled in handleNodeClick or addNode
    }
  }, [graphData.nodes.length]);

  const addNode = useCallback((article, parentId = null) => {
    setGraphData((prev) => {
      const now = Date.now();
      const existingNode = prev.nodes.find((n) => n.id === article.title);
      
      let updatedNodes = [...prev.nodes];
      let updatedLinks = [...prev.links];

      if (!existingNode) {
        const newNode = {
          id: article.title,
          label: article.title,
          extract: article.extract,
          description: article.description,
          thumbnail: article.thumbnail,
          url: article.url,
          related: article.related,
          links: article.links,
          depth: parentId
            ? (prev.nodes.find((n) => n.id === parentId)?.depth ?? 0) + 1
            : 0,
          createdAt: now,
          isContext: false,
        };
        updatedNodes.push(newNode);
      } else {
        // Update recency
        existingNode.createdAt = now;
        existingNode.isContext = false;
      }

      if (parentId && !updatedLinks.find(l => l.source === parentId && l.target === article.title)) {
        updatedLinks.push({ source: parentId, target: article.title, spine: true });
      }

      // Add context nodes (faint side branches)
      if (article.related) {
        article.related.slice(0, 5).forEach(rel => {
          if (!updatedNodes.find(n => n.id === rel.title)) {
            updatedNodes.push({
              id: rel.title,
              label: rel.title,
              isContext: true,
              depth: (updatedNodes.find(n => n.id === article.title)?.depth ?? 0) + 1,
              createdAt: now - 1000, // slightly older
            });
          }
          if (!updatedLinks.find(l => 
            (l.source === article.title && l.target === rel.title) || 
            (l.source === rel.title && l.target === article.title)
          )) {
            updatedLinks.push({ source: article.title, target: rel.title, spine: false });
          }
        });
      }

      return { nodes: updatedNodes, links: updatedLinks };
    });
  }, []);

  // Expose addNode to parent via ref
  useImperativeHandle(ref, () => ({
    addNode,
    centerAt: (x, y, duration) => fgRef.current?.centerAt(x, y, duration),
    zoom: (scale, duration) => fgRef.current?.zoom(scale, duration),
  }), [addNode]);

  const handleNodeClick = useCallback(
    (node) => {
      fgRef.current?.centerAt(node.x, node.y, 800);
      fgRef.current?.zoom(2.2, 800);
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
        onNodeClick={handleNodeClick}
        onNodeHover={setHoverNode}
        
        // Simulation settings
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTime={1500}
        onEngineStop={handleEngineStop}

        // Link styles
        linkWidth={link => link.spine ? 2.5 : 0.8}
        linkColor={link => link.spine ? "#8b5cf6" : "#2d2d3a"}
        linkDirectionalParticles={link => link.spine ? 3 : 0}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleColor={() => "#c4b5fd"}

        // Custom Node Rendering
        nodeCanvasObject={(node, ctx, globalScale) => {
          const now = Date.now();
          const age = now - (node.createdAt || now);
          const recencyFactor = Math.max(0, 1 - age / (1000 * 60 * 5)); // 5 mins fade
          
          const isMainSpine = !node.isContext;
          const radius = (isMainSpine ? 6 : 4) * Math.max(1, 4 / (node.depth + 1));
          
          // Node Birth Animation (Scale from 0)
          const birthDuration = 800;
          const scale = age < birthDuration ? age / birthDuration : 1;
          const currentRadius = radius * scale;

          // Drawing Node
          ctx.beginPath();
          ctx.arc(node.x, node.y, currentRadius, 0, 2 * Math.PI);
          
          const alpha = node.isContext ? 0.3 + (recencyFactor * 0.4) : 0.8 + (recencyFactor * 0.2);
          const baseColor = node.isContext ? "124, 58, 237" : "139, 92, 246";
          
          if (isMainSpine) {
            ctx.shadowColor = `rgba(${baseColor}, ${alpha})`;
            ctx.shadowBlur = 10 * scale;
          }

          ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Labels logic: spine nodes or hovered always visible, context nodes dim/small
          const showLabel = globalScale > 1.2 || !node.isContext || hoverNode === node;
          if (showLabel) {
            const fontSize = (node.isContext ? 10 : 13) / globalScale;
            ctx.font = `${fontSize}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillText(node.label, node.x, node.y + currentRadius + (6 / globalScale));
          }
        }}
      />
    </div>
  );
});

export default WarrenGraph;