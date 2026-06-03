"use client";
import { useEffect, useRef } from "react";

export default function BurrowCard({ node, onClose, onChipClick }) {
  const cardRef = useRef();

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose?.();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (!node) return null;

  return (
    <div
      ref={cardRef}
      style={{
        position: "fixed",
        top: "50%",
        right: "24px",
        transform: "translateY(-50%)",
        width: "340px",
        maxHeight: "80vh",
        overflowY: "auto",
        background: "#13131a",
        border: "1px solid #2d2d3a",
        borderRadius: "16px",
        padding: "24px",
        zIndex: 100,
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      {/* Thumbnail */}
      {node.thumbnail?.source && (
        <img
          src={node.thumbnail.source}
          alt={node.label}
          style={{
            width: "100%",
            height: "160px",
            objectFit: "cover",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        />
      )}

      {/* Title */}
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
        {node.label}
      </h2>

      {/* Description */}
      {node.description && (
        <p style={{ fontSize: "12px", color: "#7c7c9a", marginBottom: "12px" }}>
          {node.description}
        </p>
      )}

      {/* Extract */}
      <p style={{ fontSize: "14px", lineHeight: "1.6", color: "#c4c4d4", marginBottom: "20px" }}>
        {node.extract}
      </p>

      {/* Related chips */}
      {node.related?.length > 0 && (
        <div>
          <p style={{ fontSize: "11px", color: "#7c7c9a", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Explore next
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {node.related.map((r) => (
              <button
                key={r.title}
                onClick={() => onChipClick?.(r.title, node.id)}
                style={{
                  background: "#1e1e2e",
                  border: "1px solid #3d3d5a",
                  borderRadius: "20px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  color: "#a78bfa",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#2d2d4a";
                  e.target.style.borderColor = "#7c3aed";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "#1e1e2e";
                  e.target.style.borderColor = "#3d3d5a";
                }}
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          background: "none",
          border: "none",
          color: "#7c7c9a",
          fontSize: "18px",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}