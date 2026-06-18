import "server-only";
import Groq from "groq-sdk";
import { getServerEnv } from "@/lib/env/server";

let client: Groq | undefined;

export function getGroq() {
  if (!client) {
    const { GROQ_API_KEY } = getServerEnv();
    if (!GROQ_API_KEY) return null;
    client = new Groq({ apiKey: GROQ_API_KEY });
  }
  return client;
}

export function getGroqModel() {
  return getServerEnv().GROQ_MODEL;
}
