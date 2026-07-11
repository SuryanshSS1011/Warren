import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Env supplies the mandatory UA; cache computes through so we test the real fetch logic.
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ WIKIPEDIA_USER_AGENT: "Warren-Test/0.1 (test@warren.app)" }),
}));
vi.mock("@/lib/cache/redis", () => ({
  cached: <T>(_k: string, _t: number, compute: () => Promise<T>) => compute(),
}));

import {
  wikiFetch,
  getPageSummary,
  searchWikipedia,
  getArticleCategory,
} from "./client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("wikiFetch", () => {
  it("sends the mandatory User-Agent + Api-User-Agent headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await wikiFetch("https://en.wikipedia.org/x");
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["User-Agent"]).toContain("Warren-Test");
    expect(init.headers["Api-User-Agent"]).toContain("Warren-Test");
  });

  it("returns 2xx immediately without retry", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const res = await wikiFetch("https://en.wikipedia.org/x");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not retry a 404 (client error)", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    const res = await wikiFetch("https://en.wikipedia.org/missing");
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries on 429 then succeeds", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const p = wikiFetch("https://en.wikipedia.org/x");
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after max attempts on persistent 5xx", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response("boom", { status: 503 }));
    const p = wikiFetch("https://en.wikipedia.org/x");
    await vi.runAllTimersAsync();
    const res = await p;
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(4); // maxAttempts
  });
});

describe("getPageSummary", () => {
  it("returns null on 404", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    expect(await getPageSummary("Nonexistent")).toBeNull();
  });

  it("returns parsed summary on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: "Jazz", extract: "music", type: "standard" }));
    const s = await getPageSummary("Jazz");
    expect(s?.title).toBe("Jazz");
    expect(s?.extract).toBe("music");
  });

  it("throws on a non-404 error status", async () => {
    fetchMock.mockResolvedValue(new Response("err", { status: 400 }));
    await expect(getPageSummary("Jazz")).rejects.toThrow(/Jazz/);
  });
});

describe("searchWikipedia", () => {
  it("parses the opensearch tuple and returns titles", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(["jazz", ["Jazz", "Jazz fusion"], ["", ""], ["url1", "url2"]]),
    );
    expect(await searchWikipedia("jazz")).toEqual(["Jazz", "Jazz fusion"]);
  });

  it("returns [] on a failed request", async () => {
    fetchMock.mockResolvedValue(new Response("err", { status: 500, statusText: "err" }));
    vi.useFakeTimers();
    const p = searchWikipedia("jazz");
    await vi.runAllTimersAsync();
    expect(await p).toEqual([]);
  });
});

describe("getArticleCategory filtering", () => {
  const withCategories = (titles: string[]) =>
    jsonResponse({
      query: { pages: { "1": { categories: titles.map((t) => ({ title: `Category:${t}` })) } } },
    });

  it("drops maintenance + time-bucket + digit categories, keeps a real topic", async () => {
    fetchMock.mockResolvedValue(
      withCategories([
        "All articles with dead external links", // META
        "1687 births", // TIME
        "17th-century physicists", // digit
        "Physics", // ← the keeper
      ]),
    );
    expect(await getArticleCategory("Isaac Newton")).toBe("Physics");
  });

  it("prefers the most general (fewest-word) category", async () => {
    fetchMock.mockResolvedValue(
      withCategories(["Theoretical physicists from Germany", "Physics"]),
    );
    expect(await getArticleCategory("Einstein")).toBe("Physics");
  });

  it("returns null when nothing usable remains", async () => {
    fetchMock.mockResolvedValue(withCategories(["All stub articles", "2001 births"]));
    expect(await getArticleCategory("X")).toBeNull();
  });
});
