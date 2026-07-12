import { describe, it, expect } from "vitest";
import { parseCitations } from "./citations";

describe("parseCitations", () => {
  it("extracts <cite> references with their domain", () => {
    const html =
      '<cite class="citation">Smith, J. <a href="https://nytimes.com/x">Article</a></cite>';
    const r = parseCitations(html);
    expect(r.total).toBe(1);
    expect(r.citations[0].domain).toBe("nytimes.com");
    expect(r.citations[0].flags).toEqual([]);
  });

  it("flags user-generated and self-published sources", () => {
    const html = [
      '<cite><a href="https://en.wikipedia.org/wiki/X">wiki</a></cite>',
      '<cite><a href="https://foo.blogspot.com/p">blog</a></cite>',
      '<cite><a href="https://reddit.com/r/x">reddit</a></cite>',
    ].join("");
    const r = parseCitations(html);
    expect(r.citations[0].flags).toContain("user-generated");
    expect(r.citations[1].flags).toContain("self-published");
    expect(r.citations[2].flags).toContain("user-generated");
    expect(r.weak).toBe(3);
  });

  it("flags a reference with no external link", () => {
    const r = parseCitations("<cite>An offline book, 1990.</cite>");
    expect(r.citations[0].flags).toContain("no-source");
  });

  it("flags dead links from the template text", () => {
    const r = parseCitations(
      '<cite><a href="https://example.com/x">gone</a> [permanent dead link]</cite>',
    );
    expect(r.citations[0].flags).toContain("dead-link");
  });

  it("counts [citation needed] markers", () => {
    const html = "<p>A claim[citation needed] and another [ citation needed ].</p>";
    expect(parseCitations(html).citationNeeded).toBe(2);
  });

  it("caps the citation list", () => {
    const html = Array.from({ length: 200 }, (_, i) => `<cite><a href="https://s${i}.com/x">c</a></cite>`).join("");
    expect(parseCitations(html, 50).citations.length).toBe(50);
  });

  it("does not leak raw HTML/scripts into reference text", () => {
    const r = parseCitations('<cite>Ref<script>alert(1)</script> text</cite>');
    expect(JSON.stringify(r)).not.toContain("<script");
    expect(r.citations[0].text).not.toContain("alert");
  });

  it("returns an empty report for HTML with no references", () => {
    const r = parseCitations("<p>Just prose, no citations.</p>");
    expect(r).toEqual({ total: 0, citationNeeded: 0, weak: 0, citations: [] });
  });
});
