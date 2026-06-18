import { useState, useEffect } from "react";

// Global in-memory cache for the session to prevent redundant calls.
// This persists even when the BurrowCard component unmounts/remounts.
const narrativeCache: Record<string, string> = {};

/**
 * Custom hook to fetch and manage the semantic path narrative.
 * @param focusedNodeId The ID of the currently selected node.
 * @param path The array of concept labels representing the path to this node.
 */
export function usePathNarrative(focusedNodeId: string | null, path: string[]) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusedNodeId || path.length < 1) {
      setNarrative(null);
      return;
    }

    const pathKey = path.join("->");

    // Check cache first
    if (narrativeCache[pathKey]) {
      setNarrative(narrativeCache[pathKey]);
      setError(null);
      return;
    }

    // Reset state for new fetch
    setNarrative(null);
    setIsLoading(true);
    setError(null);

    const fetchNarrative = async () => {
      try {
        const response = await fetch("/api/narrative", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            setError("AI quota reached. Retrying automatically in a few seconds...");
            return;
          }
          throw new Error("Failed to fetch narrative");
        }

        const data = await response.json();
        const result = data.narrative;

        // Update cache and state
        narrativeCache[pathKey] = result;
        setNarrative(result);
      } catch (err) {
        console.error("Narrative fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNarrative();
  }, [focusedNodeId, path]); // Trigger when selection or the path itself changes

  return { narrative, isLoading, error };
}
