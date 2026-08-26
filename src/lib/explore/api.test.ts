import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchBridge, fetchTitle } from "./api";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

const attribution = {
  generated: true,
  model: "m",
  license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
  sources: [{ title: "A", url: "https://en.wikipedia.org/wiki/A" }],
};

describe("fetchBridge", () => {
  it("returns the bridge text and attribution", async () => {
    fetchMock.mockReturnValue(ok({ bridge: "a leap", attribution }));
    const r = await fetchBridge({ title: "A" }, { title: "B" });
    expect(r.text).toBe("a leap");
    expect(r.attribution?.generated).toBe(true);
  });

  it("defaults attribution to null when the route omits it", async () => {
    fetchMock.mockReturnValue(ok({ bridge: "a leap" }));
    const r = await fetchBridge({ title: "A" }, { title: "B" });
    expect(r.attribution).toBeNull();
  });

  it("throws on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 } as Response);
    await expect(fetchBridge({ title: "A" }, { title: "B" })).rejects.toThrow(/502/);
  });
});

describe("fetchTitle", () => {
  it("returns the title text and attribution", async () => {
    fetchMock.mockReturnValue(ok({ title: "The A to B Run", attribution }));
    const r = await fetchTitle(["A", "B"]);
    expect(r.text).toBe("The A to B Run");
    expect(r.attribution?.sources[0].title).toBe("A");
  });

  it("throws on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);
    await expect(fetchTitle(["A"])).rejects.toThrow(/429/);
  });
});
