import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const searchWikipedia = vi.hoisted(() => vi.fn());
const getPageSummary = vi.hoisted(() => vi.fn());
const getArticleLinks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wikipedia/client", () => ({
  searchWikipedia,
  getPageSummary,
  getArticleLinks,
}));

import { GET as searchGET } from "./wiki/search/route";
import { GET as summaryGET } from "./wiki/summary/route";

const getReq = (url: string) => new NextRequest(url, { method: "GET" });

beforeEach(() => {
  searchWikipedia.mockReset();
  getPageSummary.mockReset();
  getArticleLinks.mockReset();
});

describe("GET /api/wiki/search", () => {
  it("returns [] for an empty query without calling upstream", async () => {
    const res = await searchGET(getReq("http://x/api/wiki/search?q=%20%20"));
    expect((await res.json()).results).toEqual([]);
    expect(searchWikipedia).not.toHaveBeenCalled();
  });

  it("returns suggestions for a query", async () => {
    searchWikipedia.mockResolvedValue(["Jazz", "Jazz fusion"]);
    const res = await searchGET(getReq("http://x/api/wiki/search?q=jazz"));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual(["Jazz", "Jazz fusion"]);
  });

  it("502s (with empty results) on upstream failure", async () => {
    searchWikipedia.mockRejectedValue(new Error("upstream"));
    const res = await searchGET(getReq("http://x/api/wiki/search?q=jazz"));
    expect(res.status).toBe(502);
    expect((await res.json()).results).toEqual([]);
  });
});

describe("GET /api/wiki/summary", () => {
  it("400s when title is missing", async () => {
    const res = await summaryGET(getReq("http://x/api/wiki/summary"));
    expect(res.status).toBe(400);
  });

  it("404s when the article is not found", async () => {
    getPageSummary.mockResolvedValue(null);
    const res = await summaryGET(getReq("http://x/api/wiki/summary?title=Nope"));
    expect(res.status).toBe(404);
  });

  it("passes a standard summary through", async () => {
    getPageSummary.mockResolvedValue({ title: "Jazz", extract: "music", type: "standard" });
    const res = await summaryGET(getReq("http://x/api/wiki/summary?title=Jazz"));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Jazz");
  });

  it("surfaces a disambiguation chooser instead of the raw page", async () => {
    getPageSummary.mockResolvedValue({ title: "Mercury", extract: "many things", type: "disambiguation" });
    getArticleLinks.mockResolvedValue([{ title: "Mercury (element)" }, { title: "Mercury (planet)" }]);
    const res = await summaryGET(getReq("http://x/api/wiki/summary?title=Mercury"));
    const body = await res.json();
    expect(body.type).toBe("disambiguation");
    expect(body.suggestions).toHaveLength(2);
  });
});
