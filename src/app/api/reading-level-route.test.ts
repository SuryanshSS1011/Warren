import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const can = vi.hoisted(() => vi.fn());
const getArticleContent = vi.hoisted(() => vi.fn());
const rewriteAtLevelAttributed = vi.hoisted(() => vi.fn());
const checkAiRateLimit = vi.hoisted(() => vi.fn<() => Promise<unknown>>(async () => null));

vi.mock("@/lib/billing/entitlements", () => ({ can }));
vi.mock("@/lib/wikipedia/client", () => ({ getArticleContent }));
vi.mock("@/lib/ai/reading-level", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/reading-level")>(
    "@/lib/ai/reading-level",
  );
  return { ...actual, rewriteAtLevelAttributed };
});
vi.mock("@/lib/ai/guard", () => ({ checkAiRateLimit }));

import { GET } from "./wiki/reading-level/route";

const req = (qs: string) => new NextRequest(`http://x/api/wiki/reading-level${qs}`);

beforeEach(() => {
  can.mockReset();
  getArticleContent.mockReset();
  rewriteAtLevelAttributed.mockReset();
  checkAiRateLimit.mockReset();
  checkAiRateLimit.mockResolvedValue(null);
});

describe("GET /api/wiki/reading-level", () => {
  it("400s without a valid title+level", async () => {
    can.mockResolvedValue(true);
    expect((await GET(req("?title=Jazz"))).status).toBe(400); // no level
    expect((await GET(req("?title=Jazz&level=phd"))).status).toBe(400); // bad level
    expect((await GET(req("?level=eli5"))).status).toBe(400); // no title
  });

  it("402s when the user isn't Pro (before any AI work)", async () => {
    can.mockResolvedValue(false);
    const res = await GET(req("?title=Jazz&level=eli5"));
    expect(res.status).toBe(402);
    expect(getArticleContent).not.toHaveBeenCalled();
  });

  it("404s when the article has no content", async () => {
    can.mockResolvedValue(true);
    getArticleContent.mockResolvedValue({ title: "X", blocks: [] });
    expect((await GET(req("?title=X&level=simple"))).status).toBe(404);
  });

  it("returns rewritten text + attribution for an entitled user", async () => {
    can.mockResolvedValue(true);
    getArticleContent.mockResolvedValue({
      title: "Jazz",
      blocks: [{ type: "paragraph", spans: [{ text: "Jazz is music." }] }],
    });
    rewriteAtLevelAttributed.mockResolvedValue({
      text: "Jazz is a kind of music.",
      attribution: {
        generated: true,
        model: "m",
        license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
        sources: [{ title: "Jazz", url: "https://en.wikipedia.org/wiki/Jazz" }],
      },
    });
    const res = await GET(req("?title=Jazz&level=eli5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toContain("Jazz is a kind of music.");
    expect(body.level).toBe("eli5");
    expect(body.attribution.generated).toBe(true);
  });

  it("honors the rate-limit guard", async () => {
    const { NextResponse } = await import("next/server");
    can.mockResolvedValue(true);
    checkAiRateLimit.mockResolvedValue(NextResponse.json({ error: "quota" }, { status: 429 }));
    const res = await GET(req("?title=Jazz&level=eli5"));
    expect(res.status).toBe(429);
    expect(getArticleContent).not.toHaveBeenCalled();
  });
});
