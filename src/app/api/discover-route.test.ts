import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const onThisDay = vi.hoisted(() => vi.fn());
const trending = vi.hoisted(() => vi.fn());
const randomArticle = vi.hoisted(() => vi.fn());
vi.mock("@/lib/wikipedia/discover", () => ({ onThisDay, trending, randomArticle }));

import { GET } from "./discover/route";

const req = (kind?: string) =>
  new NextRequest(`http://x/api/discover${kind ? `?kind=${kind}` : ""}`);

beforeEach(() => {
  onThisDay.mockReset();
  trending.mockReset();
  randomArticle.mockReset();
});

describe("GET /api/discover", () => {
  it("400s on an unknown kind", async () => {
    expect((await GET(req())).status).toBe(400);
    expect((await GET(req("bogus"))).status).toBe(400);
  });

  it("returns on-this-day items", async () => {
    onThisDay.mockResolvedValue([{ title: "Apollo 11", extract: "x", year: 1969 }]);
    const res = await GET(req("on-this-day"));
    expect(res.status).toBe(200);
    expect((await res.json()).items[0].title).toBe("Apollo 11");
  });

  it("returns trending items", async () => {
    trending.mockResolvedValue([{ title: "Dune", extract: "y" }]);
    const res = await GET(req("trending"));
    expect((await res.json()).items[0].title).toBe("Dune");
  });

  it("returns a random item, uncached", async () => {
    randomArticle.mockResolvedValue({ title: "Octopus", extract: "z" });
    const res = await GET(req("random"));
    expect((await res.json()).item.title).toBe("Octopus");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("502s when the feed source throws", async () => {
    trending.mockImplementationOnce(() => Promise.reject(new Error("upstream")));
    expect((await GET(req("trending"))).status).toBe(502);
  });
});
