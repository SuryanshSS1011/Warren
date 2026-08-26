import "server-only";
import { generateText, activeModel } from "./provider";
import { cached } from "@/lib/cache/redis";
import { aiAttribution, type AttributedText } from "@/lib/attribution";

// Grounded "ask this article" chat (PRODUCT_PLAN §2 Pillar 2; §1.6 hallucination/BLP safety).
// The answer is grounded STRICTLY in the supplied article text — no external retrieval, no
// vector DB: the article IS the context (cheap by design). The model is instructed to answer
// only from the source and to say so when the source doesn't cover the question. Cheap per
// call but the AI cost driver — the route rate-limits and Pro-gates it.

const SYSTEM = [
  "You answer questions about a single Wikipedia article, using ONLY the article text provided.",
  "Rules: (1) Base every claim strictly on the given text — never use outside knowledge.",
  "(2) If the answer isn't in the text, say \"The article doesn't cover that.\" and stop.",
  "(3) Be concise and factual. (4) Never speculate about living people beyond what the text",
  "states. (5) No preamble — answer directly.",
].join(" ");

const ANSWER_TTL = 60 * 60 * 24 * 7; // 7 days — a (title, question) answer is stable
const MAX_CONTEXT_CHARS = 9000; // cap article context to control token cost
const MAX_QUESTION_CHARS = 400;

/** Answer a question grounded in the article text. Cached per (title, normalized question). */
export async function askArticle(
  title: string,
  question: string,
  articleText: string,
): Promise<string> {
  const q = question.trim().slice(0, MAX_QUESTION_CHARS);
  const context = articleText.slice(0, MAX_CONTEXT_CHARS);
  const key = `ai:ask:${title}:${q.toLowerCase()}`;
  return cached(key, ANSWER_TTL, () =>
    generateText({
      system: SYSTEM,
      user: `Article: "${title}"\n\n---\n${context}\n---\n\nQuestion: ${q}`,
      maxTokens: 400,
    }),
  );
}

/** As {@link askArticle}, stamped with CC BY-SA / AI-generated attribution for the article. */
export async function askArticleAttributed(
  title: string,
  question: string,
  articleText: string,
): Promise<AttributedText> {
  const text = await askArticle(title, question, articleText);
  return { text, attribution: aiAttribution(activeModel(), [title]) };
}
