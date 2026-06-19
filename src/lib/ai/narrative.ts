import "server-only";
import { generateText } from "./provider";
import { cached } from "@/lib/cache/redis";

const SYSTEM = [
  "You are a semantic cartographer. Synthesize a single, punchy paragraph that traces the",
  "conceptual lineage from a root concept to a destination, through every intermediate",
  "step. Focus strictly on the contextual bridge that connects each node in the sequence.",
  "No preamble, no fluff — just the direct conceptual thread.",
].join(" ");

const NARRATIVE_TTL = 60 * 60 * 24 * 14; // 14 days — a given path's narrative is stable

/** A concise narrative tracing a path through the graph (root → … → selected node).
    Cached by the full path so re-selecting the same node doesn't regenerate. */
export async function generatePathNarrative(path: string[]): Promise<string> {
  if (path.length < 2) return "This is your starting point in the knowledge graph.";
  const key = `ai:narrative:${path.join(">")}`;
  return cached(key, NARRATIVE_TTL, () =>
    generateText({
      system: SYSTEM,
      user: `Trace this path concisely: ${path.join(" -> ")}`,
      maxTokens: 300,
    }),
  );
}
