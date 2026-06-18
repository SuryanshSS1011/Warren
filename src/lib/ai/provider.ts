import "server-only";
import { getAiEnv } from "@/lib/env/server";
import { getAnthropic, getModel as getAnthropicModel } from "./anthropic";
import { getGemini, getGeminiModel } from "./gemini";
import { getGroq, getGroqModel } from "./groq";

export type GenerateArgs = {
  system: string;
  user: string;
  maxTokens?: number;
  provider?: "anthropic" | "gemini" | "groq";
};

/**
 * Global text generation wrapper with support for Anthropic, Gemini, and Groq.
 * Includes automatic retry logic for rate limits.
 */
export async function generateText({ system, user, maxTokens = 200, provider }: GenerateArgs) {
  const env = getAiEnv();
  const selectedProvider = provider || env.AI_PROVIDER;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      if (selectedProvider === "anthropic") {
        const client = getAnthropic();
        if (!client) throw new Error("Anthropic API key missing");
        const res = await client.messages.create({
          model: getAnthropicModel(),
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        });
        const block = res.content.find((b) => b.type === "text");
        return block && "text" in block ? block.text.trim() : "";
      }

      if (selectedProvider === "groq") {
        const client = getGroq();
        if (!client) throw new Error("Groq API key missing");
        const res = await client.chat.completions.create({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          model: getGroqModel(),
          max_tokens: maxTokens,
        });
        return res.choices[0]?.message?.content?.trim() || "";
      }

      // Default fallback: Gemini
      const client = getGemini();
      if (!client) throw new Error("Gemini API key missing");
      const res = await client.models.generateContent({
        model: getGeminiModel(),
        contents: user,
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
        },
      });
      return (res.text ?? "").trim();
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.code === 429 || error?.message?.includes("429");
      
      if (isRateLimit && attempt < maxRetries) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`AI Rate limit hit (${selectedProvider}). Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  throw new Error("Maximum AI retries exceeded");
}
