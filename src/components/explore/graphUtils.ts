import type { GraphNode } from "./types";

/**
 * Appends a research note/highlight to a specific node within the graph data.
 * This is a pure function that returns a new array of nodes to maintain 
 * React state immutability.
 * 
 * @param nodes - The current array of graph nodes
 * @param nodeId - The ID of the node to receive the note
 * @param note - The text of the highlight/note to add
 * @returns A new array of nodes with the target node updated
 */
export function addNodeNote(
  nodes: GraphNode[],
  nodeId: string,
  note: string
): GraphNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;

    // Found target node: update its researchNotes array
    const existingNotes = node.researchNotes || [];
    
    // Prevent duplicate notes if the user highlights the same thing twice
    if (existingNotes.includes(note)) return node;

    return {
      ...node,
      researchNotes: [...existingNotes, note],
    };
  });
}

/**
 * Example usage in ExploreMap or BurrowCard context:
 * 
 * const handleHighlight = (text: string) => {
 *   setPresentNodes(prev => addNodeNote(prev, selectedId, text));
 * };
 */
