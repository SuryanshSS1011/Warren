import { describe, it, expect, vi } from "vitest";

// No Upstash env → every cache op must be a graceful no-op (documented behavior).
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  }),
}));

import { cached, cacheGet, cacheSet } from "./redis";

describe("cache with no store configured", () => {
  it("cacheGet returns null", async () => {
    expect(await cacheGet("any")).toBeNull();
  });

  it("cacheSet is a silent no-op", async () => {
    await expect(cacheSet("k", { v: 1 }, 60)).resolves.toBeUndefined();
  });

  it("cached() computes through every call (no caching)", async () => {
    const compute = vi.fn().mockResolvedValue("value");
    expect(await cached("k", 60, compute)).toBe("value");
    expect(await cached("k", 60, compute)).toBe("value");
    // Called both times because nothing is stored between calls.
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
