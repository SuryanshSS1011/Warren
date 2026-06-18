import "server-only";
import { generateText } from "./provider";
import { cached } from "@/lib/cache/redis";
import type { CategoryName } from "@/lib/explore/corpus";

/** AI prompt to classify Wikipedia articles into the user's specific taxonomy. */
const SYSTEM = [
  "You are a taxonomy expert for a Wikipedia mapping tool.",
  "Categorize the given Wikipedia article into EXACTLY ONE of these categories:",
  "- Culture and the arts",
  "- Geography and places",
  "- Health and fitness",
  "- History and events",
  "- Human activities",
  "- Mathematics and logic",
  "- Natural and physical sciences",
  "- People and self",
  "- Philosophy and thinking",
  "- Religion and belief systems",
  "- Society and social sciences",
  "- Technology",
  "Respond with ONLY the exact category name from the list above. No quotes, no explanation.",
].join(" ");

const CATEGORY_TTL = 60 * 60 * 24 * 90; // 90 days — classification is stable

/**
 * Uses LLM (Anthropic/Gemini) to categorize a Wikipedia article.
 * Result is cached in Redis to minimize API costs and latency.
 */
export async function categorizeArticle(title: string, description?: string): Promise<CategoryName> {
  const key = `ai:category:${title}`;
  
  const response = await cached(key, CATEGORY_TTL, async () => {
    try {
      // This calls the real AI provider configured in your .env
      return await generateText({
        system: SYSTEM,
        user: `Article: ${title}\nDescription: ${description ?? "No description available"}`,
        maxTokens: 20,
      });
    } catch (err) {
      console.error("AI Categorization failed:", err);
      return "Natural and physical sciences"; // Default fallback on error
    }
  });

  const clean = response.trim().replace(/[".]/g, "");
  const valid: CategoryName[] = [
    "Culture and the arts",
    "Geography and places",
    "Health and fitness",
    "History and events",
    "Human activities",
    "Mathematics and logic",
    "Natural and physical sciences",
    "People and self",
    "Philosophy and thinking",
    "Religion and belief systems",
    "Society and social sciences",
    "Technology",
  ];
  
  // Find the closest match from our valid category list
  const match = valid.find((v) => v.toLowerCase() === clean.toLowerCase());

  return match ?? "Natural and physical sciences"; 
}
