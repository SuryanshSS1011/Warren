import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const can = vi.hoisted(() => vi.fn());
const loadWarren = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ value: "anon-1" as string | undefined }));

vi.mock("@/lib/billing/entitlements", () => ({ can }));
vi.mock("@/lib/explore/repository", () => ({ loadWarren }));
vi.mock("@/lib/supabase/auth", () => ({ getUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieStore.value ? { value: cookieStore.value } : undefined) }),
}));

import { GET } from "./warren/[id]/export/route";

const ctx = { params: Promise.resolve({ id: "w1" }) };
const req = (format?: string) =>
  new NextRequest(`http://x/api/warren/w1/export${format ? `?format=${format}` : ""}`);

const ownedWarren = {
  id: "w1",
  title: "Jazz Run",
  spine: ["n1"],
  nodes: [{ id: "n1", title: "Jazz", category: "Music", depth: 0 }],
  edges: [],
  stats: { hops: 0, categories: 1, minutes: 1, stars: 3 },
  startedAt: 0,
  isPublic: false,
  isOwner: true,
};

beforeEach(() => {
  can.mockReset();
  loadWarren.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue(null);
  cookieStore.value = "anon-1";
});

describe("GET /api/warren/[id]/export", () => {
  it("400s on a missing/invalid format", async () => {
    can.mockResolvedValue(true);
    expect((await GET(req(), ctx)).status).toBe(400);
    expect((await GET(req("pdf"), ctx)).status).toBe(400);
  });

  it("402s when the user isn't entitled to export (Pro feature)", async () => {
    can.mockResolvedValue(false);
    const res = await GET(req("markdown"), ctx);
    expect(res.status).toBe(402);
    expect(loadWarren).not.toHaveBeenCalled();
  });

  it("404s when the warren isn't owned by the viewer", async () => {
    can.mockResolvedValue(true);
    loadWarren.mockResolvedValue({ ...ownedWarren, isOwner: false });
    expect((await GET(req("markdown"), ctx)).status).toBe(404);
  });

  it("returns a Markdown download for an entitled owner", async () => {
    can.mockResolvedValue(true);
    loadWarren.mockResolvedValue(ownedWarren);
    const res = await GET(req("markdown"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    expect(res.headers.get("content-disposition")).toContain("jazz-run.md");
    expect(await res.text()).toContain("# Jazz Run");
  });

  it("returns an Anki CSV download", async () => {
    can.mockResolvedValue(true);
    loadWarren.mockResolvedValue(ownedWarren);
    const res = await GET(req("anki"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect((await res.text()).split("\n")[0]).toBe("Front,Back,Tags");
  });

  it("passes the viewer (anon + user) to loadWarren for ownership", async () => {
    can.mockResolvedValue(true);
    getUser.mockResolvedValue({ id: "user-9" });
    loadWarren.mockResolvedValue(ownedWarren);
    await GET(req("markdown"), ctx);
    expect(loadWarren).toHaveBeenCalledWith("w1", { anonId: "anon-1", userId: "user-9" });
  });
});
