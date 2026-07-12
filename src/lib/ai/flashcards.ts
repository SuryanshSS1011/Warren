import "server-only";
import { generateText } from "./provider";
import { cached } from "@/lib/cache/redis";

// Generate spaced-repetition flashcards from an article's text (Phase 4 Learn). Grounded in the
// supplied text (no outside knowledge); cheap — reuses the AI provider + cache. Output is a
// small set of Q/A pairs parsed from a strict line format (no vendor structured-output needed).

export type Flashcard = { front: string; back: string };

const SYSTEM = [
  "You create spaced-repetition flashcards from a Wikipedia article, using ONLY the given text.",
  "Make 6–10 cards on the most important, memorable facts. Each card: a specific question and a",
  "short factual answer (one sentence). Avoid trivia and yes/no questions. Base everything on the",
  "text — no outside knowledge.",
  "Output EXACTLY one card per line as `Q: <question> ||| A: <answer>` and nothing else.",
].join(" ");

const CARDS_TTL = 60 * 60 * 24 * 30; // 30 days — cards for an article are stable
const MAX_CONTEXT_CHARS = 9000;
const MAX_CARDS = 12;

/** Parse the strict `Q: … ||| A: …` line format into cards, tolerating minor drift. */
export function parseFlashcards(raw: string): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*Q:\s*(.+?)\s*\|\|\|\s*A:\s*(.+?)\s*$/i.exec(line);
    if (!m) continue;
    const front = m[1].trim();
    const back = m[2].trim();
    if (front && back) cards.push({ front, back });
    if (cards.length >= MAX_CARDS) break;
  }
  return cards;
}

/** Generate flashcards for `title` from its article text. Cached per title. */
export async function generateFlashcards(title: string, articleText: string): Promise<Flashcard[]> {
  const context = articleText.slice(0, MAX_CONTEXT_CHARS);
  const key = `ai:cards:${title}`;
  return cached(key, CARDS_TTL, async () => {
    const raw = await generateText({
      system: SYSTEM,
      user: `Article: "${title}"\n\n---\n${context}\n---`,
      maxTokens: 700,
    });
    return parseFlashcards(raw);
  });
}
