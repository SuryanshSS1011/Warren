import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePathNarrative } from "./usePathNarrative";

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

describe("usePathNarrative", () => {
  it("stays idle with no focused node", () => {
    const { result } = renderHook(() => usePathNarrative(null, []));
    expect(result.current.narrative).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // NB: createPersistentCache keeps a module-level in-memory mirror that outlives a single
  // test, so each test uses a DISTINCT path to avoid cross-test cache collisions.
  it("fetches, then exposes narrative + attribution", async () => {
    const attribution = {
      generated: true,
      model: "m",
      license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
      sources: [{ title: "Fetch1", url: "https://en.wikipedia.org/wiki/Fetch1" }],
    };
    fetchMock.mockReturnValue(ok({ narrative: "the thread", attribution }));

    const { result } = renderHook(() => usePathNarrative("live:Fetch2", ["Fetch1", "Fetch2"]));
    await waitFor(() => expect(result.current.narrative).toBe("the thread"));
    expect(result.current.attribution?.generated).toBe(true);
    expect(result.current.attribution?.sources[0].title).toBe("Fetch1");
    expect(result.current.error).toBeNull();
  });

  it("surfaces a friendly message on 429", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);
    const { result } = renderHook(() => usePathNarrative("live:Q2", ["Quota1", "Quota2"]));
    await waitFor(() => expect(result.current.error).toMatch(/quota/i));
    expect(result.current.narrative).toBeNull();
  });

  it("reports a generic error on other failures", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    const { result } = renderHook(() => usePathNarrative("live:E2", ["Err1", "Err2"]));
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  it("serves a repeat path from cache without refetching", async () => {
    fetchMock.mockReturnValue(ok({ narrative: "cached thread", attribution: null }));
    const first = renderHook(() => usePathNarrative("live:C2", ["Cache1", "Cache2"]));
    await waitFor(() => expect(first.result.current.narrative).toBe("cached thread"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A fresh hook with the same path should hit the persistent cache, not fetch again.
    const second = renderHook(() => usePathNarrative("live:C2", ["Cache1", "Cache2"]));
    await waitFor(() => expect(second.result.current.narrative).toBe("cached thread"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
