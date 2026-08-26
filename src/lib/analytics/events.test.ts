import { describe, it, expect, vi, beforeEach } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@vercel/analytics", () => ({ track }));

import { trackEvent } from "./events";

beforeEach(() => track.mockReset());

describe("trackEvent", () => {
  it("forwards the event name and data to Vercel Analytics", () => {
    trackEvent("warren_saved", { hops: 3 });
    expect(track).toHaveBeenCalledWith("warren_saved", { hops: 3 });
  });

  it("works without a data payload", () => {
    trackEvent("session_start");
    expect(track).toHaveBeenCalledWith("session_start", undefined);
  });

  it("never propagates an analytics failure to the caller", () => {
    // The real track() is wrapped in try/catch in trackEvent; simulate a failing sink and
    // assert the caller is unaffected. (Vitest flags a raw throwing mock as an unhandled
    // error even when caught, so reject via a rejected value the wrapper swallows instead.)
    const boom = new Error("analytics down");
    track.mockImplementationOnce(() => {
      throw boom;
    });
    const run = () => trackEvent("warren_shared");
    expect(run).not.toThrow();
  });
});
