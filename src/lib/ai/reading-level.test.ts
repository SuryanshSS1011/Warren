import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateText, activeModel } = vi.hoisted(() => ({
  generateText: vi.fn(),
  activeModel: vi.fn(() => "test-model"),
}));
vi.mock("./provider", () => ({ generateText, activeModel }));
vi.mock("@/lib/cache/redis", () => ({
  cached: <T>(_k: string, _t: number, compute: () => Promise<T>) => compute(),
}));

import {
  isReadingLevel,
  READING_LEVELS,
  rewriteAtLevel,
  rewriteAtLevelAttributed,
} from "./reading-level";

beforeEach(() => {
  generateText.mockReset();
  generateText.mockResolvedValue("rewritten prose");
  activeModel.mockReturnValue("test-model");
});

describe("isReadingLevel", () => {
  it("accepts the three levels and rejects others", () => {
    for (const l of READING_LEVELS) expect(isReadingLevel(l)).toBe(true);
    expect(isReadingLevel("phd")).toBe(false);
    expect(isReadingLevel("original")).toBe(false);
  });
});

describe("rewriteAtLevel", () => {
  it("calls the model with a level-specific system prompt", async () => {
    await rewriteAtLevel("Jazz", "eli5", "some source text");
    const args = generateText.mock.calls[0][0];
    expect(args.system.toLowerCase()).toContain("10-year-old");
    expect(args.user).toContain("Jazz");
    expect(args.user).toContain("some source text");
  });

  it("clips very long source text to bound cost", async () => {
    const huge = "x".repeat(20000);
    await rewriteAtLevel("T", "simple", huge);
    const user = generateText.mock.calls[0][0].user as string;
    // user = prompt preamble + clipped(<=8000) source; well under the raw 20000.
    expect(user.length).toBeLessThan(9000);
  });

  it("uses distinct prompts per level", async () => {
    await rewriteAtLevel("T", "expert", "s");
    const expertPrompt = generateText.mock.calls[0][0].system as string;
    expect(expertPrompt.toLowerCase()).toContain("expert");
  });
});

describe("rewriteAtLevelAttributed", () => {
  it("returns the rewrite with CC BY-SA / AI-generated attribution for the article", async () => {
    const out = await rewriteAtLevelAttributed("Jazz", "simple", "src");
    expect(out.text).toBe("rewritten prose");
    expect(out.attribution.generated).toBe(true);
    expect(out.attribution.model).toBe("test-model");
    expect(out.attribution.sources.map((s) => s.title)).toEqual(["Jazz"]);
    expect(out.attribution.license.id).toBe("CC-BY-SA-4.0");
  });
});
