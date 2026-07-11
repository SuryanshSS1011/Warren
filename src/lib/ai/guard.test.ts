import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const rateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cache/redis", () => ({ rateLimit }));

import { checkAiRateLimit } from "./guard";

const reqWith = (headers: Record<string, string> = {}) =>
  new NextRequest("http://x/api/bridge", { method: "POST", headers });

beforeEach(() => rateLimit.mockReset());

describe("checkAiRateLimit", () => {
  it("returns null (proceed) when under the limit", async () => {
    rateLimit.mockResolvedValue({ ok: true, remaining: 10, limit: 60 });
    expect(await checkAiRateLimit(reqWith(), "bridge")).toBeNull();
  });

  it("returns a 429 with Retry-After when over the limit", async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, limit: 60 });
    const res = await checkAiRateLimit(reqWith(), "bridge");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("retry-after")).toBeTruthy();
  });

  it("keys the limit by client IP from x-forwarded-for and by bucket", async () => {
    rateLimit.mockResolvedValue({ ok: true, remaining: 1, limit: 60 });
    await checkAiRateLimit(reqWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "title");
    const key = rateLimit.mock.calls[0][0] as string;
    expect(key).toContain("ai:title:");
    expect(key).toContain("203.0.113.7");
    expect(key).not.toContain("10.0.0.1"); // only the first (client) IP
  });

  it("falls back to 'unknown' when no IP headers are present", async () => {
    rateLimit.mockResolvedValue({ ok: true, remaining: 1, limit: 60 });
    await checkAiRateLimit(reqWith(), "narrative");
    expect(rateLimit.mock.calls[0][0]).toContain("ai:narrative:unknown");
  });
});
