import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env/server";

let client: Anthropic | undefined;

export function getAnthropic() {
  if (!client) {
    const { ANTHROPIC_API_KEY } = getServerEnv();
    if (!ANTHROPIC_API_KEY) return null;
    client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return client;
}

export function getModel() {
  return getServerEnv().ANTHROPIC_MODEL;
}
