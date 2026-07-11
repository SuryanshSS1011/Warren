import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./extension/hop/route";

const savedToken = process.env.WARREN_EXTENSION_TOKEN;
afterEach(() => {
  if (savedToken === undefined) delete process.env.WARREN_EXTENSION_TOKEN;
  else process.env.WARREN_EXTENSION_TOKEN = savedToken;
});

function hopReq(opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return new NextRequest("http://x/api/extension/hop", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? { type: "WIKI_PAGE_LOAD", title: "Jazz" }),
  });
}

describe("POST /api/extension/hop — auth gate", () => {
  beforeEach(() => {
    delete process.env.WARREN_EXTENSION_TOKEN;
  });

  it("503s when no token is configured (write path disabled by default)", async () => {
    const res = await POST(hopReq({ token: "anything" }));
    expect(res.status).toBe(503);
  });

  it("401s when a token is configured but the request omits/mismatches it", async () => {
    process.env.WARREN_EXTENSION_TOKEN = "secret";
    expect((await POST(hopReq())).status).toBe(401);
    expect((await POST(hopReq({ token: "wrong" }))).status).toBe(401);
  });

  it("accepts a correct bearer token and a valid body", async () => {
    process.env.WARREN_EXTENSION_TOKEN = "secret";
    const res = await POST(hopReq({ token: "secret" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("400s an authorized request with an invalid body", async () => {
    process.env.WARREN_EXTENSION_TOKEN = "secret";
    const res = await POST(hopReq({ token: "secret", body: { type: "BOGUS" } }));
    expect(res.status).toBe(400);
  });
});
