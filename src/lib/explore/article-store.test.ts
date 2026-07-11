import { describe, it, expect } from "vitest";
import {
  isLiveId,
  liveIdFor,
  wikiTitleFor,
  upsertLive,
  resolve,
  placeholder,
} from "./article-store";
import { UNCATEGORIZED } from "./hue";

describe("live id helpers", () => {
  it("round-trips a title through liveIdFor / wikiTitleFor", () => {
    const id = liveIdFor("Gravity well");
    expect(id).toBe("live:Gravity well");
    expect(isLiveId(id)).toBe(true);
    expect(wikiTitleFor(id)).toBe("Gravity well");
  });

  it("treats a non-live id as its own title", () => {
    expect(isLiveId("Gravity well")).toBe(false);
    expect(wikiTitleFor("Gravity well")).toBe("Gravity well");
  });
});

describe("upsertLive / resolve", () => {
  it("stores and resolves a fetched article", () => {
    const a = upsertLive({ title: "Octopus", category: "Biology", extract: "eight arms" });
    expect(a.id).toBe("live:Octopus");
    expect(a.category).toBe("Biology");
    expect(resolve("live:Octopus")?.extract).toBe("eight arms");
  });

  it("merges partial updates over an existing entry", () => {
    upsertLive({ title: "Jazz", category: "Music" });
    const merged = upsertLive({ title: "Jazz", extract: "improvised" });
    expect(merged.category).toBe("Music"); // preserved
    expect(merged.extract).toBe("improvised"); // added
  });

  it("defaults an unresolved category to the placeholder", () => {
    const a = upsertLive({ title: "Volcano" });
    expect(a.category).toBe(UNCATEGORIZED);
  });
});

describe("placeholder", () => {
  it("returns a known article if already fetched", () => {
    upsertLive({ title: "Renaissance", category: "History" });
    expect(placeholder("live:Renaissance").category).toBe("History");
  });

  it("synthesizes a minimal article for an unfetched id", () => {
    const p = placeholder("live:Totally New Topic");
    expect(p.title).toBe("Totally New Topic");
    expect(p.category).toBe(UNCATEGORIZED);
    expect(p.extract).toBe("");
    expect(p.source).toBe("live");
  });
});
