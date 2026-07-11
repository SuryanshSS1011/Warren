import { describe, it, expect } from "vitest";
import { createPersistentCache } from "./persistent-cache";

// In the node test environment there is no `window`, so the cache degrades to an in-memory
// Map (its documented SSR/privacy-mode fallback). These tests pin that behavior.
describe("createPersistentCache (in-memory fallback)", () => {
  it("stores and retrieves by key", () => {
    const c = createPersistentCache("warren:test:");
    expect(c.get("k")).toBeNull();
    c.set("k", "v");
    expect(c.get("k")).toBe("v");
    expect(c.has("k")).toBe(true);
  });

  it("namespaces are independent", () => {
    const a = createPersistentCache("ns-a:");
    const b = createPersistentCache("ns-b:");
    a.set("shared", "from-a");
    expect(b.get("shared")).toBeNull();
  });

  it("overwrites an existing key", () => {
    const c = createPersistentCache("warren:ovr:");
    c.set("k", "1");
    c.set("k", "2");
    expect(c.get("k")).toBe("2");
  });
});
