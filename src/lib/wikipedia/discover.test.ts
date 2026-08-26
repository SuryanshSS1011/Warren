import { describe, it, expect, vi, beforeEach } from "vitest";

const wikiFetch = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ wikiFetch }));
vi.mock("@/lib/cache/redis", () => ({
  cached: <T>(_k: string, _t: number, compute: () => Promise<T>) => compute(),
}));

import { onThisDay, trending, randomArticle } from "./discover";

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}

beforeEach(() => wikiFetch.mockReset());

describe("onThisDay", () => {
  it("maps events to items with year, title, extract, thumbnail", async () => {
    wikiFetch.mockReturnValue(
      ok({
        events: [
          {
            year: 1969,
            pages: [{ normalizedtitle: "Apollo 11", extract: "Moon landing.", thumbnail: { source: "u" } }],
          },
          { year: 1215, pages: [{ title: "Magna_Carta", extract: "A charter." }] },
        ],
      }),
    );
    const items = await onThisDay(new Date(Date.UTC(2026, 6, 20)));
    expect(items[0]).toEqual({
      title: "Apollo 11",
      extract: "Moon landing.",
      thumbnail: "u",
      year: 1969,
    });
    expect(items[1].title).toBe("Magna Carta"); // underscores → spaces
    expect(items[1].year).toBe(1215);
  });

  it("requests the correct MM/DD path (UTC) and returns [] on failure", async () => {
    wikiFetch.mockResolvedValue({ ok: false } as Response);
    await onThisDay(new Date(Date.UTC(2026, 0, 5)));
    expect(wikiFetch.mock.calls[0][0]).toContain("/feed/onthisday/events/01/05");
    expect(await onThisDay(new Date(Date.UTC(2026, 0, 5)))).toEqual([]);
  });
});

describe("trending", () => {
  it("maps mostread articles and filters Main Page / specials", async () => {
    wikiFetch.mockReturnValue(
      ok({
        mostread: {
          articles: [
            { normalizedtitle: "Main Page", extract: "" },
            { normalizedtitle: "Dune (novel)", extract: "A book.", thumbnail: { source: "t" } },
            { title: "Special:Random", extract: "" },
          ],
        },
      }),
    );
    const items = await trending(new Date(Date.UTC(2026, 6, 19)));
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Dune (novel)");
  });

  it("hits the featured feed with the date path", async () => {
    wikiFetch.mockResolvedValue({ ok: false } as Response);
    await trending(new Date(Date.UTC(2026, 6, 19)));
    expect(wikiFetch.mock.calls[0][0]).toContain("/feed/featured/2026/07/19");
  });
});

describe("randomArticle", () => {
  it("returns a single mapped item", async () => {
    wikiFetch.mockReturnValue(ok({ title: "Octopus", extract: "Eight arms." }));
    expect(await randomArticle()).toEqual({ title: "Octopus", extract: "Eight arms." });
  });

  it("returns null on failure", async () => {
    wikiFetch.mockResolvedValue({ ok: false } as Response);
    expect(await randomArticle()).toBeNull();
  });
});
