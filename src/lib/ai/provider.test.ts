import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the two SDK client modules and the env so provider dispatch can be tested offline.
const anthropicCreate = vi.hoisted(() => vi.fn());
const geminiGenerate = vi.hoisted(() => vi.fn());
const aiEnv = vi.hoisted(() => ({ value: { AI_PROVIDER: "anthropic" as "anthropic" | "gemini" } }));

vi.mock("@/lib/env/server", () => ({
  getAiEnv: () => aiEnv.value,
}));
vi.mock("./anthropic", () => ({
  getAnthropic: () => ({ messages: { create: anthropicCreate } }),
  getModel: () => "claude-haiku-test",
}));
vi.mock("./gemini", () => ({
  getGemini: () => ({ models: { generateContent: geminiGenerate } }),
  getGeminiModel: () => "gemini-test",
}));

import { generateText, activeModel } from "./provider";

beforeEach(() => {
  anthropicCreate.mockReset();
  geminiGenerate.mockReset();
  aiEnv.value = { AI_PROVIDER: "anthropic" };
});

describe("generateText — anthropic branch", () => {
  it("returns the first text block, trimmed", async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "  hello world  " }],
    });
    const out = await generateText({ system: "s", user: "u" });
    expect(out).toBe("hello world");
    expect(anthropicCreate).toHaveBeenCalledOnce();
  });

  it("returns empty string when no text block is present", async () => {
    anthropicCreate.mockResolvedValue({ content: [{ type: "tool_use" }] });
    expect(await generateText({ system: "s", user: "u" })).toBe("");
  });
});

describe("generateText — gemini branch", () => {
  it("routes to gemini and returns its text", async () => {
    aiEnv.value = { AI_PROVIDER: "gemini" };
    geminiGenerate.mockResolvedValue({ text: "  gem out  " });
    const out = await generateText({ system: "s", user: "u" });
    expect(out).toBe("gem out");
    expect(geminiGenerate).toHaveBeenCalledOnce();
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it("tolerates a missing text field", async () => {
    aiEnv.value = { AI_PROVIDER: "gemini" };
    geminiGenerate.mockResolvedValue({});
    expect(await generateText({ system: "s", user: "u" })).toBe("");
  });
});

describe("activeModel", () => {
  it("reflects the selected provider's model id", () => {
    expect(activeModel()).toBe("claude-haiku-test");
    aiEnv.value = { AI_PROVIDER: "gemini" };
    expect(activeModel()).toBe("gemini-test");
  });
});
