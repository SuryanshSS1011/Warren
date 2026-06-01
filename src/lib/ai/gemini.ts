import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getServerEnv } from "@/lib/env/server";

let client: GoogleGenAI | undefined;

export function getGemini() {
  if (!client) {
    const { GEMINI_API_KEY } = getServerEnv();
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return client;
}

export function getGeminiModel() {
  return getServerEnv().GEMINI_MODEL;
}
