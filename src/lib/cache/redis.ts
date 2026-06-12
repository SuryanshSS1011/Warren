// Server-only cache wrapper over Upstash Redis. When the Upstash env vars are unset
// (e.g. local dev without a KV store) every operation is a graceful no-op, so the app
// works without a cache — it just refetches. See BUILD_PLAN.md "Cache" section.
import "server-only";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env/server";

let client: Redis | null | undefined;

function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getServerEnv();
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    client = null;
    return null;
  }
  client = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
  return client;
}

/** Read a JSON value from cache. Returns null on miss, no cache, or any error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    // Upstash auto-deserializes JSON values it stored.
    return (await r.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

/** Write a JSON value with a TTL (seconds). Silently does nothing without a cache. */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: ttlSeconds });
  } catch {
    // best-effort cache; never let a cache write break a request
  }
}

// Stored values are wrapped in an envelope so a cached `null`/`undefined` (a valid
// negative result, e.g. a Wikipedia 404) is distinguishable from a cache miss — otherwise
// negatives would never cache and would re-hit upstream on every request.
type Envelope<T> = { v: T };

/** Read-through helper: return cached value (incl. cached negatives) or compute + cache.
    `negativeTtlSeconds` caps how long falsy/empty results are cached (default: 5 min) so a
    transiently-missing page isn't pinned for the full TTL. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
  negativeTtlSeconds = 300,
): Promise<T> {
  const hit = await cacheGet<Envelope<T>>(key);
  if (hit && typeof hit === "object" && "v" in hit) return hit.v;
  const value = await compute();
  const isNegative = value == null || (Array.isArray(value) && value.length === 0);
  await cacheSet<Envelope<T>>(key, { v: value }, isNegative ? negativeTtlSeconds : ttlSeconds);
  return value;
}
