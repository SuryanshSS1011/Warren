import "server-only";
import { getServerEnv } from "@/lib/env/server";
import { getAnthropic, getModel as getAnthropicModel } from "./anthropic";
import { getGemini, getGeminiModel } from "./gemini";

export type GenerateArgs = {
  system: string;
  user: string;
  maxTokens?: number;
};

export async function generateText({ system, user, maxTokens = 200 }: GenerateArgs) {
  const { AI_PROVIDER } = getServerEnv();

  if (AI_PROVIDER === "anthropic") {
    const res = await getAnthropic().messages.create({
      model: getAnthropicModel(),
      max_tokens: maxTokens,
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
    },
  });
  return (res.text ?? "").trim();
}
