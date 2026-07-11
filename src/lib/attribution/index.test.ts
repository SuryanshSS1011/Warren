import { describe, it, expect } from "vitest";
import {
  CC_BY_SA_4_0,
  WIKIPEDIA,
  wikipediaArticleUrl,
  toSource,
  aiAttribution,
} from "./index";

describe("wikipediaArticleUrl", () => {
  it("turns spaces into underscores", () => {
    expect(wikipediaArticleUrl("Albert Einstein")).toBe(
      "https://en.wikipedia.org/wiki/Albert_Einstein",
    );
  });

  it("percent-encodes reserved characters", () => {
    expect(wikipediaArticleUrl("C++")).toBe("https://en.wikipedia.org/wiki/C%2B%2B");
    expect(wikipediaArticleUrl("Rock & Roll")).toBe(
      "https://en.wikipedia.org/wiki/Rock_%26_Roll",
    );
  });

  it("preserves slashes in titles rather than encoding them to %2F", () => {
    // Wikipedia subpages / titles like AC/DC keep the slash as a path separator.
    expect(wikipediaArticleUrl("AC/DC")).toBe("https://en.wikipedia.org/wiki/AC/DC");
  });

  it("keeps non-ASCII letters encoded but valid", () => {
    expect(wikipediaArticleUrl("São Paulo")).toContain("https://en.wikipedia.org/wiki/S");
  });

  it("trims surrounding whitespace", () => {
    expect(wikipediaArticleUrl("  Bonobo  ")).toBe("https://en.wikipedia.org/wiki/Bonobo");
  });
});

describe("toSource", () => {
  it("pairs a title with its article URL", () => {
    expect(toSource("Bonobo")).toEqual({
      title: "Bonobo",
      url: "https://en.wikipedia.org/wiki/Bonobo",
    });
  });
});

describe("aiAttribution", () => {
  it("stamps the AI-generated flag, license, model, and per-source links", () => {
    const stamp = aiAttribution("claude-haiku-4-5", ["Bonobo", "Chimpanzee"]);
    expect(stamp.generated).toBe(true);
    expect(stamp.model).toBe("claude-haiku-4-5");
    expect(stamp.license).toEqual(CC_BY_SA_4_0);
    expect(stamp.sources).toEqual([
      { title: "Bonobo", url: "https://en.wikipedia.org/wiki/Bonobo" },
      { title: "Chimpanzee", url: "https://en.wikipedia.org/wiki/Chimpanzee" },
    ]);
  });

  it("handles an empty source list", () => {
    const stamp = aiAttribution("m", []);
    expect(stamp.sources).toEqual([]);
    expect(stamp.generated).toBe(true);
  });
});

describe("license + trademark constants", () => {
  it("points at the canonical CC BY-SA 4.0 deed", () => {
    expect(CC_BY_SA_4_0.id).toBe("CC-BY-SA-4.0");
    expect(CC_BY_SA_4_0.url).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
  });

  it("carries the Wikimedia non-affiliation disclaimer", () => {
    expect(WIKIPEDIA.disclaimer).toMatch(/not endorsed by or affiliated with/i);
  });
});
