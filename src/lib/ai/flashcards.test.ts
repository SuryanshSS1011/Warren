import { describe, it, expect, vi, beforeEach } from "vitest";

const generateText = vi.hoisted(() => vi.fn());
vi.mock("./provider", () => ({ generateText, activeModel: () => "m" }));
vi.mock("@/lib/cache/redis", () => ({
  cached: <T>(_k: string, _t: number, compute: () => Promise<T>) => compute(),
}));

import { parseFlashcards, generateFlashcards } from "./flashcards";

describe("parseFlashcards", () => {
  it("parses the strict Q ||| A line format", () => {
    const raw = "Q: What is jazz? ||| A: A music genre.\nQ: Where from? ||| A: New Orleans.";
    expect(parseFlashcards(raw)).toEqual([
      { front: "What is jazz?", back: "A music genre." },
      { front: "Where from?", back: "New Orleans." },
    ]);
  });

  it("ignores lines that don't match and preamble", () => {
    const raw = "Here are your cards:\nQ: A? ||| A: B.\nrandom noise\n- bullet";
    expect(parseFlashcards(raw)).toEqual([{ front: "A?", back: "B." }]);
  });

  it("skips cards missing a side", () => {
    expect(parseFlashcards("Q:  ||| A: only answer")).toEqual([]);
  });

  it("caps the number of cards", () => {
    const raw = Array.from({ length: 30 }, (_, i) => `Q: q${i} ||| A: a${i}`).join("\n");
    expect(parseFlashcards(raw).length).toBeLessThanOrEqual(12);
  });
});

describe("generateFlashcards", () => {
  beforeEach(() => generateText.mockReset());

  it("prompts grounded on the article text and returns parsed cards", async () => {
    generateText.mockResolvedValue("Q: What? ||| A: This.");
    const cards = await generateFlashcards("Jazz", "Jazz is a genre from New Orleans.");
    const { system, user } = generateText.mock.calls[0][0];
    expect(system.toLowerCase()).toContain("only the given text");
    expect(user).toContain("Jazz is a genre from New Orleans.");
    expect(cards).toEqual([{ front: "What?", back: "This." }]);
  });
});
