import "server-only";
import { getAnthropic, getModel } from "./anthropic";

export type ConnectiveTissueInput = {
  from: { title: string; description?: string };
  to: { title: string; description?: string };
};

const SYSTEM = [
  "You write one vivid sentence explaining the conceptual bridge a curious",
  "reader crosses between two Wikipedia articles. Be specific and a little",
  "playful. Never exceed one sentence. Never add quotes or hedging.",
].join(" ");

export async function generateConnectiveTissue(input: ConnectiveTissueInput) {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: getModel(),
    max_tokens: 120,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `From: ${input.from.title} — ${input.from.description ?? ""}\nTo: ${input.to.title} — ${input.to.description ?? ""}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text.trim() : "";
}
