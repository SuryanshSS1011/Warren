import "server-only";
import { getAiEnv } from "@/lib/env/server";
import { getAnthropic, getModel as getAnthropicModel } from "./anthropic";
import { getGemini, getGeminiModel } from "./gemini";

export type GenerateArgs = {
  system: string;
  user: string;
  maxTokens?: number;
  /** Low by default so a cache-miss regeneration (after TTL expiry) yields a stable,
      near-deterministic result for the same input — bridges/titles/narratives shouldn't
      drift between generations of the same content. */
  temperature?: number;
};

export async function generateText({
  system,
  user,
  maxTokens = 200,
  temperature = 0.3,
}: GenerateArgs) {
  // Validates the selected provider's key here (lazily) — keeps non-AI paths AI-free.
  const { AI_PROVIDER } = getAiEnv();

  if (AI_PROVIDER === "anthropic") {
    const res = await getAnthropic().messages.create({
      model: getAnthropicModel(),
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && "text" in block ? block.text.trim() : "";
  }

  const res = await getGemini().models.generateContent({
    model: getGeminiModel(),
    contents: user,
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      temperature,
    },
  });
  return (res.text ?? "").trim();
}
