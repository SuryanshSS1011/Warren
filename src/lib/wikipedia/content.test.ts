import { describe, it, expect } from "vitest";
import { parseArticleHtml, hrefToTitle } from "./content";

describe("hrefToTitle", () => {
  it("resolves ./Title and /wiki/Title article links", () => {
    expect(hrefToTitle("./Black_hole")).toBe("Black hole");
    expect(hrefToTitle("/wiki/Jazz")).toBe("Jazz");
  });

  it("decodes percent-encoding and underscores", () => {
    expect(hrefToTitle("./Rock_%26_Roll")).toBe("Rock & Roll");
  });

  it("strips fragments", () => {
    expect(hrefToTitle("./Jazz#History")).toBe("Jazz");
  });

  it("rejects namespaced links (File:, Help:, Category:, …)", () => {
    expect(hrefToTitle("./File:Foo.jpg")).toBeNull();
    expect(hrefToTitle("/wiki/Category:Physics")).toBeNull();
    expect(hrefToTitle("./Help:Contents")).toBeNull();
    expect(hrefToTitle("./Wikipedia:About")).toBeNull();
  });

  it("rejects external, relative-fragment, and empty links", () => {
    expect(hrefToTitle("https://evil.com")).toBeNull();
    expect(hrefToTitle("#cite_note-1")).toBeNull();
    expect(hrefToTitle("./")).toBeNull();
    expect(hrefToTitle("mailto:x@y.com")).toBeNull();
  });
});

describe("parseArticleHtml", () => {
  it("extracts paragraphs and headings as blocks", () => {
    const html = `
      <section><p>The first paragraph.</p>
      <h2>History</h2>
      <p>Some <a href="./Physics">physics</a> here.</p>
      <h3>Details</h3></section>`;
    const { blocks } = parseArticleHtml(html, "Test");
    expect(blocks[0]).toEqual({ type: "paragraph", spans: [{ text: "The first paragraph." }] });
    expect(blocks[1]).toEqual({ type: "heading", level: 2, spans: [{ text: "History" }] });
    expect(blocks[2].type).toBe("paragraph");
    expect(blocks[3]).toEqual({ type: "heading", level: 3, spans: [{ text: "Details" }] });
  });

  it("keeps article links as {text, link} spans and hop targets", () => {
    const { blocks } = parseArticleHtml('<p>See <a href="./Event_horizon">the horizon</a> now.</p>', "T");
    const spans = (blocks[0] as { spans: unknown[] }).spans;
    expect(spans).toEqual([
      { text: "See " },
      { text: "the horizon", link: "Event horizon" },
      { text: " now." },
    ]);
  });

  it("renders a non-article link as plain text (no link field)", () => {
    const { blocks } = parseArticleHtml('<p>A <a href="./File:X.jpg">file</a> ref.</p>', "T");
    const spans = (blocks[0] as { spans: { text: string; link?: string }[] }).spans;
    expect(spans.some((s) => s.link)).toBe(false);
    expect(spans.map((s) => s.text).join("")).toContain("file");
  });

  describe("SECURITY: no script/HTML survives into the block model", () => {
    it("drops <script> tags entirely", () => {
      const { blocks } = parseArticleHtml(
        '<p>Safe text<script>alert(1)</script> after.</p>',
        "T",
      );
      const text = JSON.stringify(blocks);
      expect(text).not.toContain("alert");
      expect(text).not.toContain("<script");
    });

    it("does not carry event-handler attributes or raw tags in text", () => {
      const { blocks } = parseArticleHtml(
        '<p>Hi <a href="./Jazz" onclick="steal()">jazz</a> <img src=x onerror=alert(1)></p>',
        "T",
      );
      const s = JSON.stringify(blocks);
      expect(s).not.toContain("onclick");
      expect(s).not.toContain("onerror");
      expect(s).not.toContain("<img");
      // the legit article link still resolves
      expect(s).toContain('"link":"Jazz"');
    });

    it("strips reference superscripts like [1]", () => {
      const { blocks } = parseArticleHtml(
        '<p>A claim<sup class="reference">[1]</sup> stands.</p>',
        "T",
      );
      expect((blocks[0] as { spans: { text: string }[] }).spans[0].text).not.toContain("[1]");
    });

    it("ignores tables, infoboxes, and other non-allowlisted blocks", () => {
      const { blocks } = parseArticleHtml(
        '<table><tr><td>infobox junk</td></tr></table><p>Real prose.</p>',
        "T",
      );
      expect(blocks).toHaveLength(1);
      expect((blocks[0] as { spans: { text: string }[] }).spans[0].text).toBe("Real prose.");
    });
  });

  it("decodes HTML entities in text", () => {
    const { blocks } = parseArticleHtml("<p>Tom &amp; Jerry &lt;3</p>", "T");
    expect((blocks[0] as { spans: { text: string }[] }).spans[0].text).toBe("Tom & Jerry <3");
  });

  it("skips empty paragraphs", () => {
    const { blocks } = parseArticleHtml("<p></p><p>  </p><p>Real.</p>", "T");
    expect(blocks).toHaveLength(1);
  });
});
