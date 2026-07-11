import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the AI lib layer so routes are tested in isolation from real providers.
const generateConnectiveTissueAttributed = vi.hoisted(() => vi.fn());
const generateAutoTitleAttributed = vi.hoisted(() => vi.fn());
const generatePathNarrativeAttributed = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/connective-tissue", () => ({ generateConnectiveTissueAttributed }));
vi.mock("@/lib/ai/auto-title", () => ({ generateAutoTitleAttributed }));
vi.mock("@/lib/ai/narrative", () => ({ generatePathNarrativeAttributed }));

// A representative attribution stamp for mocked AI results.
const stamp = (sources: string[]) => ({
  generated: true as const,
  model: "test-model",
  license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
  sources: sources.map((t) => ({ title: t, url: `https://en.wikipedia.org/wiki/${t}` })),
});

import { POST as bridgePOST } from "./bridge/route";
import { POST as titlePOST } from "./title/route";
import { POST as narrativePOST } from "./narrative/route";

function postReq(url: string, body: unknown, raw = false) {
  return new NextRequest(url, {
    method: "POST",
    body: raw ? (body as string) : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  generateConnectiveTissueAttributed.mockReset();
  generateAutoTitleAttributed.mockReset();
  generatePathNarrativeAttributed.mockReset();
});

describe("POST /api/bridge", () => {
  it("returns the bridge sentence AND attribution for a valid body", async () => {
    generateConnectiveTissueAttributed.mockResolvedValue({
      text: "a curious leap",
      attribution: stamp(["A", "B"]),
    });
    const res = await bridgePOST(
      postReq("http://x/api/bridge", { from: { title: "A" }, to: { title: "B" } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bridge).toBe("a curious leap");
    expect(body.attribution.generated).toBe(true);
    expect(body.attribution.sources.map((s: { title: string }) => s.title)).toEqual(["A", "B"]);
  });

  it("400s on invalid body", async () => {
    const res = await bridgePOST(postReq("http://x/api/bridge", { from: {} }));
    expect(res.status).toBe(400);
    expect(generateConnectiveTissueAttributed).not.toHaveBeenCalled();
  });

  it("400s on malformed json", async () => {
    const res = await bridgePOST(postReq("http://x/api/bridge", "{not json", true));
    expect(res.status).toBe(400);
  });

  it("maps a provider quota error to 429", async () => {
    generateConnectiveTissueAttributed.mockRejectedValue(new Error("429 rate limit"));
    const res = await bridgePOST(
      postReq("http://x/api/bridge", { from: { title: "A" }, to: { title: "B" } }),
    );
    expect(res.status).toBe(429);
  });
});

describe("POST /api/title", () => {
  it("returns a title AND attribution for a valid path", async () => {
    generateAutoTitleAttributed.mockResolvedValue({
      text: "The A to B Run",
      attribution: stamp(["A", "B"]),
    });
    const res = await titlePOST(postReq("http://x/api/title", { path: ["A", "B"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("The A to B Run");
    expect(body.attribution.generated).toBe(true);
  });

  it("400s on an empty path", async () => {
    const res = await titlePOST(postReq("http://x/api/title", { path: [] }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/narrative", () => {
  it("returns narrative text AND attribution", async () => {
    generatePathNarrativeAttributed.mockResolvedValue({
      text: "the thread",
      attribution: {
        generated: true,
        model: "m",
        license: { id: "CC-BY-SA-4.0", name: "CC BY-SA 4.0", url: "https://cc" },
        sources: [{ title: "A", url: "https://en.wikipedia.org/wiki/A" }],
      },
    });
    const res = await narrativePOST(postReq("http://x/api/narrative", { path: ["A", "B"] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.narrative).toBe("the thread");
    expect(body.attribution.generated).toBe(true);
    expect(body.attribution.license.id).toBe("CC-BY-SA-4.0");
  });

  it("400s when path exceeds the max length", async () => {
    const res = await narrativePOST(
      postReq("http://x/api/narrative", { path: Array.from({ length: 41 }, (_, i) => `n${i}`) }),
    );
    expect(res.status).toBe(400);
  });
});
