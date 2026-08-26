import "server-only";
import { generateText, activeModel } from "./provider";
import { cached } from "@/lib/cache/redis";
import { aiAttribution, type AttributedText } from "@/lib/attribution";

// Reading-level rewrite (PRODUCT_PLAN §2, Pillar 2). This is an AI-MODIFIES-CC-TEXT surface:
// the output is a paraphrase, so it MUST carry attribution + the AI-generated flag and must
// never be presented as Wikipedia's own words. The caller renders it inside the attributed
// reader, not as the raw article.

export type ReadingLevel = "eli5" | "simple" | "expert";

export const READING_LEVELS: ReadingLevel[] = ["eli5", "simple", "expert"];

export function isReadingLevel(v: string): v is ReadingLevel {
  return (READING_LEVELS as string[]).includes(v);
}

const SYSTEM: Record<ReadingLevel, string> = {
  eli5: [
    "You rewrite an encyclopedia passage so a curious 10-year-old understands it.",
    "Use plain words, short sentences, and everyday analogies. Keep every fact accurate —",
    "simplify the language, never the truth. Do not add facts that aren't in the source.",
    "Output only the rewritten prose, no preamble.",
  ].join(" "),
  simple: [
    "You rewrite an encyclopedia passage in clear, plain English for a general adult reader.",
    "Prefer common words and shorter sentences; keep all the substance and every fact.",
    "Do not add facts that aren't in the source. Output only the rewritten prose, no preamble.",
  ].join(" "),
  expert: [
    "You rewrite an encyclopedia passage for an expert reader: precise, information-dense,",
    "using correct technical terminology and assuming domain fluency. Keep every fact accurate",
    "and add none that aren't in the source. Output only the rewritten prose, no preamble.",
  ].join(" "),
};

const LEVEL_TTL = 60 * 60 * 24 * 14; // 14 days — a (title, level) rewrite is stable
const MAX_INPUT_CHARS = 8000; // cap source length to control token cost / latency

/**
 * Rewrite `sourceText` (the article's plain prose) at `level`. Cached per (title, level) so a
 * given rewrite is generated once. The plain text is passed in by the caller (derived from the
 * safe content blocks) so this module never touches raw HTML.
 */
export async function rewriteAtLevel(
  title: string,
  level: ReadingLevel,
  sourceText: string,
): Promise<string> {
  const clipped = sourceText.slice(0, MAX_INPUT_CHARS);
  const key = `ai:level:${level}:${title}`;
  return cached(key, LEVEL_TTL, () =>
    generateText({
      system: SYSTEM[level],
      user: `Rewrite this passage about "${title}":\n\n${clipped}`,
      maxTokens: 900,
    }),
  );
}

/** As {@link rewriteAtLevel}, stamped with CC BY-SA / AI-generated attribution for `title`. */
export async function rewriteAtLevelAttributed(
  title: string,
  level: ReadingLevel,
  sourceText: string,
): Promise<AttributedText> {
  const text = await rewriteAtLevel(title, level, sourceText);
  return { text, attribution: aiAttribution(activeModel(), [title]) };
}
