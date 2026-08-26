import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateText, activeModel } = vi.hoisted(() => ({
  generateText: vi.fn(),
  activeModel: vi.fn(() => "test-model"),
}));
vi.mock("./provider", () => ({ generateText, activeModel }));
vi.mock("@/lib/cache/redis", () => ({
  cached: <T>(_k: string, _t: number, compute: () => Promise<T>) => compute(),
}));

import { askArticle, askArticleAttributed } from "./ask-article";

beforeEach(() => {
  generateText.mockReset();
  generateText.mockResolvedValue("A grounded answer.");
  activeModel.mockReturnValue("test-model");
});

describe("askArticle", () => {
  it("instructs the model to answer ONLY from the provided text", async () => {
    await askArticle("Jazz", "Where did it start?", "Jazz began in New Orleans.");
    const { system, user } = generateText.mock.calls[0][0];
    expect(system.toLowerCase()).toContain("only");
    expect(system.toLowerCase()).toContain("doesn't cover");
    // The article text is embedded as context.
    expect(user).toContain("Jazz began in New Orleans.");
    expect(user).toContain("Where did it start?");
  });

  it("clips overlong article context and question to bound cost", async () => {
    await askArticle("T", "q".repeat(1000), "x".repeat(50000));
    const user = generateText.mock.calls[0][0].user as string;
    expect(user.length).toBeLessThan(10000);
  });
});

describe("askArticleAttributed", () => {
  it("returns the answer with attribution for the article", async () => {
    const out = await askArticleAttributed("Jazz", "q", "context");
    expect(out.text).toBe("A grounded answer.");
    expect(out.attribution.generated).toBe(true);
    expect(out.attribution.sources.map((s) => s.title)).toEqual(["Jazz"]);
  });
});
