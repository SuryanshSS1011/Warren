import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// getServerEnv() memoizes at module scope, so each case resets modules + re-imports with a
// freshly-built process.env. A minimal valid env is the baseline; cases perturb one field.
const BASE = {
  WIKIPEDIA_USER_AGENT: "Warren/0.1 (https://warren.app; team@warren.app)",
};

let saved: NodeJS.ProcessEnv;
beforeEach(() => {
  saved = process.env;
  vi.resetModules();
});
afterEach(() => {
  process.env = saved;
});

async function loadEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...saved, ...BASE, ...overrides } as NodeJS.ProcessEnv;
  return import("./server");
}

describe("getServerEnv", () => {
  it("parses a minimal valid env and defaults AI_PROVIDER to anthropic", async () => {
    const { getServerEnv } = await loadEnv({ AI_PROVIDER: undefined });
    expect(getServerEnv().AI_PROVIDER).toBe("anthropic");
  });

  it("requires WIKIPEDIA_USER_AGENT", async () => {
    const { getServerEnv } = await loadEnv({ WIKIPEDIA_USER_AGENT: undefined });
    process.env.WIKIPEDIA_USER_AGENT = undefined;
    expect(() => getServerEnv()).toThrow();
  });

  it("treats an empty/whitespace optional secret as absent", async () => {
    const { getServerEnv } = await loadEnv({ ANTHROPIC_API_KEY: "   " });
    expect(getServerEnv().ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("supplies a default anthropic model", async () => {
    const { getServerEnv } = await loadEnv({ ANTHROPIC_MODEL: undefined });
    expect(getServerEnv().ANTHROPIC_MODEL).toMatch(/haiku/i);
  });
});

describe("getAiEnv", () => {
  it("throws when the anthropic provider is selected but no key is set", async () => {
    const { getAiEnv } = await loadEnv({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: undefined,
    });
    expect(() => getAiEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("throws when the gemini provider is selected but no key is set", async () => {
    const { getAiEnv } = await loadEnv({
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: undefined,
    });
    expect(() => getAiEnv()).toThrow(/GEMINI_API_KEY/);
  });

  it("passes when the selected provider's key is present", async () => {
    const { getAiEnv } = await loadEnv({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-test",
    });
    expect(() => getAiEnv()).not.toThrow();
  });
});
