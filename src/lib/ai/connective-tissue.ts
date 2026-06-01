import "server-only";
import { generateText } from "./provider";

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
  return generateText({
    system: SYSTEM,
    user: `From: ${input.from.title} — ${input.from.description ?? ""}\nTo: ${input.to.title} — ${input.to.description ?? ""}`,
    maxTokens: 120,
  });
}
