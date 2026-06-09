import { z } from "zod";

const ServerEnv = z
  .object({
    AI_PROVIDER: z.enum(["anthropic", "gemini"]).default("anthropic"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
    // New Supabase key format: server-only secret key (sb_secret_…). Replaces the legacy
    // service_role JWT. Optional so the app boots without persistence configured.
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    WIKIPEDIA_USER_AGENT: z.string().min(1),
    // Upstash Redis (optional). When unset, caching is a no-op so dev still works.
    UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  })
  .refine(
    (e) => (e.AI_PROVIDER === "anthropic" ? !!e.ANTHROPIC_API_KEY : !!e.GEMINI_API_KEY),
    {
      message: "Missing API key for the selected AI_PROVIDER",
      path: ["AI_PROVIDER"],
    },
  );

let cached: z.infer<typeof ServerEnv> | undefined;

export function getServerEnv() {
  if (!cached) cached = ServerEnv.parse(process.env);
  return cached;
}
