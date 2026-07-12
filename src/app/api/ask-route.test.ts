import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const can = vi.hoisted(() => vi.fn());
const getArticleContent = vi.hoisted(() => vi.fn());
const askArticleAttributed = vi.hoisted(() => vi.fn());
const checkAiRateLimit = vi.hoisted(() => vi.fn<() => Promise<unknown>>(async () => null));

vi.mock("@/lib/billing/entitlements", () => ({ can }));
vi.mock("@/lib/wikipedia/client", () => ({ getArticleContent }));
vi.mock("@/lib/ai/ask-article", () => ({ askArticleAttributed }));
vi.mock("@/lib/ai/guard", () => ({ checkAiRateLimit }));

import { POST } from "./wiki/ask/route";

function req(body: unknown, raw = false) {
  return new NextRequest("http://x/api/wiki/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  can.mockReset();
  getArticleContent.mockReset();
  askArticleAttributed.mockReset();
  checkAiRateLimit.mockReset();
  checkAiRateLimit.mockResolvedValue(null);
});

describe("POST /api/wiki/ask", () => {
  it("400s on malformed json / invalid body", async () => {
    can.mockResolvedValue(true);
    expect((await POST(req("{bad", true))).status).toBe(400);
    expect((await POST(req({ title: "Jazz" }))).status).toBe(400); // no question
    expect((await POST(req({ question: "hi" }))).status).toBe(400); // no title
  });

  it("402s when not Pro (before any AI work)", async () => {
    can.mockResolvedValue(false);
    const res = await POST(req({ title: "Jazz", question: "why?" }));
    expect(res.status).toBe(402);
    expect(getArticleContent).not.toHaveBeenCalled();
  });

  it("honors the rate limit", async () => {
    const { NextResponse } = await import("next/server");
    can.mockResolvedValue(true);
    checkAiRateLimit.mockResolvedValue(NextResponse.json({ error: "quota" }, { status: 429 }));
    const res = await POST(req({ title: "Jazz", question: "why?" }));
    expect(res.status).toBe(429);
    expect(getArticleContent).not.toHaveBeenCalled();
  });

  it("404s when the article has no content", async () => {
    can.mockResolvedValue(true);
    getArticleContent.mockResolvedValue({ title: "X", blocks: [] });
    expect((await POST(req({ title: "X", question: "q" }))).status).toBe(404);
  });

  it("returns a grounded answer + attribution for an entitled user", async () => {
    can.mockResolvedValue(true);
    getArticleContent.mockResolvedValue({
      title: "Jazz",
      blocks: [{ type: "paragraph", spans: [{ text: "Jazz began in New Orleans." }] }],
    });
    askArticleAttributed.mockResolvedValue({
      text: "It started in New Orleans.",
      attribution: {
        generated: true, model: "m",
        license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
        sources: [{ title: "Jazz", url: "https://en.wikipedia.org/wiki/Jazz" }],
      },
    });
    const res = await POST(req({ title: "Jazz", question: "Where did it start?" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toContain("New Orleans");
    expect(body.attribution.generated).toBe(true);
    // The AI is grounded on the article text we fetched.
    expect(askArticleAttributed).toHaveBeenCalledWith(
      "Jazz",
      "Where did it start?",
      expect.stringContaining("Jazz began in New Orleans."),
    );
  });
});
