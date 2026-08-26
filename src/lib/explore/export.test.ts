import { describe, it, expect } from "vitest";
import { toMarkdown, toAnkiCsv, csvCell, exportFilename, type ExportableWarren } from "./export";

const warren: ExportableWarren = {
  title: "Black Hole to Jazz",
  spine: ["n1", "n2", "n3"],
  nodes: [
    { id: "n1", title: "Black hole", category: "Physics", depth: 0 },
    { id: "n2", title: "Spacetime", category: "Physics", depth: 1 },
    { id: "n3", title: "Jazz", category: "Music", depth: 2 },
    { id: "n4", title: "Improvisation", category: "Music", depth: 2 }, // a branch
  ],
  edges: [
    { source: "n1", target: "n2", spine: true, bridge: "Gravity warps spacetime." },
    { source: "n2", target: "n3", spine: true, bridge: "A leap from physics to rhythm." },
    { source: "n3", target: "n4", spine: false, bridge: "Jazz thrives on improvisation." },
  ],
  startedAt: 1_700_000_000_000,
  stats: { hops: 2, categories: 2, minutes: 5, stars: 4 },
};

describe("csvCell", () => {
  it("leaves simple values unquoted", () => {
    expect(csvCell("Physics")).toBe("Physics");
  });
  it("quotes and doubles inner quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it("quotes values with commas or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toMarkdown", () => {
  const md = toMarkdown(warren);

  it("titles the document and lists the path in order with bridges", () => {
    expect(md).toContain("# Black Hole to Jazz");
    expect(md.indexOf("[[Black hole]]")).toBeLessThan(md.indexOf("[[Spacetime]]"));
    expect(md.indexOf("[[Spacetime]]")).toBeLessThan(md.indexOf("[[Jazz]]"));
    expect(md).toContain("*Gravity warps spacetime.*");
  });

  it("uses [[wiki-links]] and includes Wikipedia source links", () => {
    expect(md).toContain("[[Jazz]]");
    expect(md).toContain("https://en.wikipedia.org/wiki/Jazz");
  });

  it("separates branch nodes under 'Also explored'", () => {
    expect(md).toContain("## Also explored");
    expect(md).toContain("[[Improvisation]]");
  });

  it("carries the CC BY-SA + AI-generated attribution footer", () => {
    expect(md).toMatch(/CC BY-SA 4\.0/);
    expect(md).toMatch(/AI-generated/i);
  });

  it("does not put the first spine node's bridge before it", () => {
    // Black hole is the start — no incoming bridge line above item 1.
    const firstIdx = md.indexOf("1. [[Black hole]]");
    const before = md.slice(0, firstIdx);
    expect(before).not.toContain("*Gravity warps spacetime.*");
  });
});

describe("toAnkiCsv", () => {
  const csv = toAnkiCsv(warren);
  const lines = csv.split("\n");

  it("starts with the Front,Back,Tags header", () => {
    expect(lines[0]).toBe("Front,Back,Tags");
  });

  it("makes one card per article (spine first) plus bridge cards", () => {
    expect(csv).toContain("What is Black hole?");
    expect(csv).toContain("What is Jazz?");
    expect(csv).toContain("What is Improvisation?"); // branch node included
    expect(csv).toContain("How does “Black hole” connect to “Spacetime”?");
  });

  it("tags cards under the warren", () => {
    expect(csv).toContain("warren::Black_Hole_to_Jazz");
  });

  it("escapes fields that contain commas/quotes so columns stay intact", () => {
    const tricky: ExportableWarren = {
      ...warren,
      nodes: [{ id: "n1", title: 'Comma, and "quote"', category: "X", depth: 0 }],
      spine: ["n1"],
      edges: [],
    };
    const out = toAnkiCsv(tricky);
    // The front cell must be a single quoted field, not split into extra columns.
    expect(out).toContain('"What is Comma, and ""quote""?"');
  });
});

describe("exportFilename", () => {
  it("slugifies the title with the right extension", () => {
    expect(exportFilename("Black Hole to Jazz", "markdown")).toBe("black-hole-to-jazz.md");
    expect(exportFilename("Black Hole to Jazz", "anki")).toBe("black-hole-to-jazz.csv");
  });
  it("falls back to 'warren' for an empty slug", () => {
    expect(exportFilename("!!!", "markdown")).toBe("warren.md");
  });
});
