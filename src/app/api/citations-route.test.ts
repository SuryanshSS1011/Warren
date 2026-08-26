import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const can = vi.hoisted(() => vi.fn());
const getCitations = vi.hoisted(() => vi.fn());
vi.mock("@/lib/billing/entitlements", () => ({ can }));
vi.mock("@/lib/wikipedia/client", () => ({ getCitations }));

import { GET } from "./wiki/citations/route";

const req = (title?: string) =>
  new NextRequest(`http://x/api/wiki/citations${title ? `?title=${title}` : ""}`);

beforeEach(() => {
  can.mockReset();
  getCitations.mockReset();
});

describe("GET /api/wiki/citations", () => {
  it("400s without a title", async () => {
    can.mockResolvedValue(true);
    expect((await GET(req())).status).toBe(400);
  });

  it("402s when not Researcher (before any fetch)", async () => {
    can.mockResolvedValue(false);
    const res = await GET(req("Jazz"));
    expect(res.status).toBe(402);
    expect(getCitations).not.toHaveBeenCalled();
  });

  it("404s when the article isn't found", async () => {
    can.mockResolvedValue(true);
    getCitations.mockResolvedValue(null);
    expect((await GET(req("Nope"))).status).toBe(404);
  });

  it("returns the citation report for an entitled user", async () => {
    can.mockResolvedValue(true);
    getCitations.mockResolvedValue({ total: 3, citationNeeded: 1, weak: 1, citations: [] });
    const res = await GET(req("Jazz"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.weak).toBe(1);
  });

  it("502s on an upstream error", async () => {
    can.mockResolvedValue(true);
    getCitations.mockImplementationOnce(() => Promise.reject(new Error("boom")));
    expect((await GET(req("Jazz"))).status).toBe(502);
  });
});
