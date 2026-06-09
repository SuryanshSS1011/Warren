import "server-only";
import { generateText } from "./provider";
import { cached } from "@/lib/cache/redis";

export type ConnectiveTissueInput = {
  from: { title: string; description?: string };
  to: { title: string; description?: string };
};

const SYSTEM = [
  "You write one vivid sentence explaining the conceptual bridge a curious",
  "reader crosses between two Wikipedia articles. Be specific and a little",
  "playful. Never exceed one sentence. Never add quotes or hedging.",
].join(" ");

const BRIDGE_TTL = 60 * 60 * 24 * 30; // 30 days — a given (A→B) bridge is stable

export async function generateConnectiveTissue(input: ConnectiveTissueInput) {
  // Cache every (A→B) pair so the same jump is never regenerated (BUILD_PLAN.md).
  const key = `ai:bridge:${input.from.title}>${input.to.title}`;
  return cached(key, BRIDGE_TTL, () =>
    generateText({
      system: SYSTEM,
      user: `From: ${input.from.title} — ${input.from.description ?? ""}\nTo: ${input.to.title} — ${input.to.description ?? ""}`,
      maxTokens: 120,
    }),
  );
}
