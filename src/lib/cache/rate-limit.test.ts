import { describe, it, expect, vi, beforeEach } from "vitest";

// A configurable Upstash mock so we can drive incr/expire behavior.
const store = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  configured: true,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    incr = store.incr;
    expire = store.expire;
    get = vi.fn();
    set = vi.fn();
  },
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () =>
    store.configured
      ? { UPSTASH_REDIS_REST_URL: "https://x", UPSTASH_REDIS_REST_TOKEN: "t" }
      : { UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined },
}));

import { rateLimit } from "./redis";

beforeEach(() => {
  store.incr.mockReset();
  store.expire.mockReset();
  store.configured = true;
});

describe("rateLimit", () => {
  it("allows a request under the limit and sets TTL on the first hit", async () => {
    store.incr.mockResolvedValue(1);
    const r = await rateLimit("k", 5, 60);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
    expect(store.expire).toHaveBeenCalledWith("ratelimit:k", 60);
  });

  it("does not reset TTL on subsequent hits", async () => {
    store.incr.mockResolvedValue(3);
    const r = await rateLimit("k", 5, 60);
    expect(r.ok).toBe(true);
    expect(store.expire).not.toHaveBeenCalled();
  });

  it("blocks once the count exceeds the limit", async () => {
    store.incr.mockResolvedValue(6);
    const r = await rateLimit("k", 5, 60);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("allows exactly at the limit boundary", async () => {
    store.incr.mockResolvedValue(5);
    expect((await rateLimit("k", 5, 60)).ok).toBe(true);
  });

  it("fails OPEN when Upstash errors", async () => {
    store.incr.mockRejectedValue(new Error("redis down"));
    const r = await rateLimit("k", 5, 60);
    expect(r.ok).toBe(true);
  });

  it("fails OPEN (allows) when Upstash is unconfigured", async () => {
    // getRedis() memoizes its client at module scope, so re-evaluate the module with the
    // unconfigured env to exercise the no-client branch in isolation.
    store.configured = false;
    vi.resetModules();
    const { rateLimit: freshRateLimit } = await import("./redis");
    const r = await freshRateLimit("k", 5, 60);
    expect(r.ok).toBe(true);
    expect(store.incr).not.toHaveBeenCalled();
  });
});
