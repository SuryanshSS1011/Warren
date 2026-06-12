import "server-only";
import { generateText } from "./provider";
import { cached } from "@/lib/cache/redis";

const SYSTEM = [
  "You write a witty, shareable title for a Wikipedia reading journey — like a Spotify",
  "Wrapped headline. Title Case, max 8 words, no quotes, no trailing punctuation.",
  "Capture the leap from the first topic to the last.",
].join(" ");

const TITLE_TTL = 60 * 60 * 24 * 30; // 30 days — a given path's title is stable

/** Generate a witty auto-title for a journey given the ordered list of node titles.
    Cached by the first→last pair so the same run isn't regenerated. */
export async function generateAutoTitle(pathTitles: string[]): Promise<string> {
  if (pathTitles.length < 2) return pathTitles[0] ?? "Untitled warren";
  const first = pathTitles[0];
  const last = pathTitles[pathTitles.length - 1];
  const key = `ai:title:${first}>${last}`;
  return cached(key, TITLE_TTL, () =>
    generateText({
      system: SYSTEM,
      user: `Journey: ${pathTitles.join(" → ")}`,
      maxTokens: 24,
    }),
  );
}
