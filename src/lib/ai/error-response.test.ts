import { describe, it, expect } from "vitest";
import { aiErrorResponse } from "./error-response";

describe("aiErrorResponse", () => {
  it("maps quota/rate-limit errors to 429 with a friendly message", async () => {
    for (const msg of [
      "429 Too Many Requests",
      "rate limit exceeded",
      "resource_exhausted",
      "quota reached",
    ]) {
      const res = aiErrorResponse(new Error(msg));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toMatch(/quota/i);
    }
  });

  it("maps everything else to a 502 without leaking the raw error", async () => {
    const res = aiErrorResponse(new Error("upstream exploded: {secret: internal}"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("AI is temporarily unavailable.");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("handles non-Error throwables", async () => {
    const res = aiErrorResponse("plain string boom");
    expect(res.status).toBe(502);
  });
});
