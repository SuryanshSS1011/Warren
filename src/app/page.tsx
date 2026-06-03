"use client";
import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import BurrowCard from "@/components/BurrowCard";

const WarrenGraph = dynamic(() => import("@/components/GraphSpike"), {
  ssr: false,
});

export default function Home() {
  const graphRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAndAddNode = useCallback(async (title, parentId = null) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
      );
      const article = await res.json();
      if (article.error) return;

      // Add node to graph
      graphRef.current?.addNode(article, parentId);

      // Auto-select the new node to open burrow card
      setSelectedNode({ ...article, id: article.title, label: article.title });
    } catch (err) {
      console.error("Failed to fetch article:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      if (!search.trim()) return;
      fetchAndAddNode(search.trim());
      setSearch("");
    },
    [search, fetchAndAddNode]
  );

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  const handleChipClick = useCallback(
    (title, parentId) => {
      fetchAndAddNode(title, parentId);
    },
    [fetchAndAddNode]
  );

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0a0f" }}>

      {/* Search bar */}
      <form
        onSubmit={handleSearch}
        style={{
          position: "fixed",
          top: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 200,
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Start a rabbit hole..."
          style={{
            width: "320px",
            padding: "12px 20px",
            borderRadius: "30px",
            border: "1px solid #3d3d5a",
            background: "#13131a",
            color: "white",
            fontSize: "15px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 20px",
            borderRadius: "30px",
            border: "none",
            background: "#7c3aed",
            color: "white",
            fontSize: "15px",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "..." : "Explore"}
        </button>
      </form>

      {/* Graph */}
      <WarrenGraph
        ref={graphRef}
        onNodeClick={handleNodeClick}
      />

      {/* Burrow card */}
      <BurrowCard
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onChipClick={handleChipClick}
      />
    </div>
  );
}