import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getArticleContent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/wikipedia/client", () => ({ getArticleContent }));

import { GET } from "./wiki/content/route";

const getReq = (url: string) => new NextRequest(url, { method: "GET" });

beforeEach(() => getArticleContent.mockReset());

describe("GET /api/wiki/content", () => {
  it("400s when title is missing", async () => {
    const res = await GET(getReq("http://x/api/wiki/content"));
    expect(res.status).toBe(400);
  });

  it("404s when the article isn't found", async () => {
    getArticleContent.mockResolvedValue(null);
    const res = await GET(getReq("http://x/api/wiki/content?title=Nope"));
    expect(res.status).toBe(404);
  });

  it("returns the block model for a found article", async () => {
    getArticleContent.mockResolvedValue({
      title: "Jazz",
      blocks: [{ type: "paragraph", spans: [{ text: "Music." }] }],
    });
    const res = await GET(getReq("http://x/api/wiki/content?title=Jazz"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Jazz");
    expect(body.blocks).toHaveLength(1);
  });

  it("502s on an upstream error", async () => {
    // Return a promise that rejects on await (avoids Vitest flagging a bare rejected mock).
    getArticleContent.mockImplementationOnce(() => Promise.reject(new Error("upstream")));
    const res = await GET(getReq("http://x/api/wiki/content?title=Jazz"));
    expect(res.status).toBe(502);
  });
});
