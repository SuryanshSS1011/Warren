import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the provider so no real AI call happens, and the cache so `cached` just computes.
// vi.hoisted lets the (hoisted) vi.mock factories reference these mocks safely.
const { generateText, activeModel } = vi.hoisted(() => ({
  generateText: vi.fn(),
  activeModel: vi.fn(() => "test-model-1"),
}));
vi.mock("./provider", () => ({ generateText, activeModel }));
vi.mock("@/lib/cache/redis", () => ({
  cached: <T>(_key: string, _ttl: number, compute: () => Promise<T>) => compute(),
}));

import { generateConnectiveTissueAttributed } from "./connective-tissue";
import { generatePathNarrativeAttributed } from "./narrative";
import { generateAutoTitleAttributed } from "./auto-title";

beforeEach(() => {
  generateText.mockReset();
  generateText.mockResolvedValue("generated text");
  activeModel.mockReturnValue("test-model-1");
});

describe("generateConnectiveTissueAttributed", () => {
  it("returns the text plus attribution for both bridged articles", async () => {
    const out = await generateConnectiveTissueAttributed({
      from: { title: "Bonobo" },
      to: { title: "Chimpanzee" },
    });
    expect(out.text).toBe("generated text");
    expect(out.attribution.generated).toBe(true);
    expect(out.attribution.model).toBe("test-model-1");
    expect(out.attribution.sources.map((s) => s.title)).toEqual(["Bonobo", "Chimpanzee"]);
  });
});

describe("generatePathNarrativeAttributed", () => {
  it("attributes every article in the path", async () => {
    const out = await generatePathNarrativeAttributed(["A", "B", "C"]);
    expect(out.attribution.sources.map((s) => s.title)).toEqual(["A", "B", "C"]);
    expect(out.attribution.license.id).toBe("CC-BY-SA-4.0");
  });

  it("short-circuits a single-node path without calling the model", async () => {
    const out = await generatePathNarrativeAttributed(["Solo"]);
    expect(generateText).not.toHaveBeenCalled();
    expect(out.text).toMatch(/starting point/i);
    expect(out.attribution.sources).toEqual([{ title: "Solo", url: expect.any(String) }]);
  });
});

describe("generateAutoTitleAttributed", () => {
  it("attributes the journey's articles", async () => {
    const out = await generateAutoTitleAttributed(["First", "Last"]);
    expect(out.attribution.sources.map((s) => s.title)).toEqual(["First", "Last"]);
    expect(out.attribution.model).toBe("test-model-1");
  });
});
