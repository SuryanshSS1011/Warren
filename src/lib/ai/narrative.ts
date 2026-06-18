import { generateText } from "./provider";

/**
 * Generates a concise semantic narrative tracing a path in the knowledge graph.
 * @param path An array of string labels from the root to the selected node.
 */
export async function generatePathNarrative(path: string[]): Promise<string> {
  if (path.length < 2) {
    return "This is your starting point in the knowledge graph.";
  }

  const pathString = path.join(" -> ");
  
  const system = `You are a semantic cartographer. 
Synthesize a single, punchy paragraph that traces the conceptual lineage from a root concept to a destination, through all intermediate steps. 
Focus strictly on the contextual bridge that connects each node in the sequence. 
No preamble, no fluff—just the direct conceptual thread.`;

  const user = `Trace this path concisely: ${pathString}`;

  try {
    const narrative = await generateText({
      system,
      user,
      maxTokens: 300,
      provider: "groq", // Using Groq for speed and generous free-tier limits
    });
    
    return narrative;
  } catch (error) {
    console.error("Error generating path narrative:", error);
    throw error;
  }
}
