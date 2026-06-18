import { z } from "zod";

// Base server env. The AI key is NOT required here on purpose: non-AI code paths (the
// Wikipedia proxy, the Upstash cache) call getServerEnv() too and must work without any
// AI key configured. The selected provider's key is validated lazily in getAiEnv(), only
// when the AI layer actually runs.
// Treat empty/whitespace env vars as absent (people often leave `KEY=` in .env files);
// an empty optional key shouldn't crash the schema for non-AI paths.
const optionalSecret = z
  .string()
  .optional()
  .transform((s) => {
    const t = s?.trim();
    return t ? t : undefined;
  });

const ServerEnv = z.object({
  AI_PROVIDER: z.enum(["anthropic", "gemini", "groq"]).default("anthropic"),
  ANTHROPIC_API_KEY: optionalSecret,
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  // New Supabase key format: server-only secret key (sb_secret_…). Replaces the legacy
  // service_role JWT. Optional so the app boots without persistence configured.
  SUPABASE_SECRET_KEY: optionalSecret,
  WIKIPEDIA_USER_AGENT: z.string().min(1),
  // Upstash Redis (optional). When unset, caching is a no-op so dev still works.
  UPSTASH_REDIS_REST_URL: optionalSecret,
  UPSTASH_REDIS_REST_TOKEN: optionalSecret,
});

let cached: z.infer<typeof ServerEnv> | undefined;

export function getServerEnv() {
  if (!cached) cached = ServerEnv.parse(process.env);
  return cached;
}

/**
 * Validate + return the env for the selected AI provider. Throws only here — call this
 * from the AI layer right before generating, so the Wikipedia/cache paths stay AI-free.
 */
export function getAiEnv() {
  const env = getServerEnv();
  // Return env even if keys are missing; the AI layer will catch the error
  // and fall back to defaults (see categorizeArticle).
  return env;
}
