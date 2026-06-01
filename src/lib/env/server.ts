import { z } from "zod";

const ServerEnv = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WIKIPEDIA_USER_AGENT: z.string().min(1),
});

let cached: z.infer<typeof ServerEnv> | undefined;

export function getServerEnv() {
  if (!cached) cached = ServerEnv.parse(process.env);
  return cached;
}
