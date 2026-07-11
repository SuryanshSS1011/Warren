// Parse Wikipedia article HTML into a SAFE, structured block model the native reader renders
// without dangerouslySetInnerHTML. We deliberately keep only a tiny allowlist — paragraphs,
// headings, and internal /wiki/ links as data — and drop everything else (scripts, tables,
// infoboxes, references, styles). The client renders these blocks with its own components, so
// no raw Wikipedia HTML ever reaches the DOM. Framework/DOM-agnostic (runs on the server).

export type TextSpan =
  | { text: string }
  | { text: string; link: string }; // link = a Wikipedia article title to hop to

export type Block =
  | { type: "heading"; level: 2 | 3; spans: TextSpan[] }
  | { type: "paragraph"; spans: TextSpan[] };

export type ArticleContent = {
  title: string;
  blocks: Block[];
};

const MAX_BLOCKS = 400; // generous cap; guards against pathological pages

/** Decode the handful of HTML entities that appear in extracted text. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** A /wiki/<Title> href → the article title to hop to, or null for non-article links. */
export function hrefToTitle(href: string): string | null {
  // Only same-wiki article links (./Foo or /wiki/Foo). Reject namespaces (Foo:Bar),
  // fragments, external links, and special pages.
  let path = href;
  if (path.startsWith("./")) path = path.slice(2);
  else if (path.startsWith("/wiki/")) path = path.slice(6);
  else return null;
  if (!path || path.startsWith("#")) return null;
  const noFragment = path.split("#")[0];
  let title: string;
  try {
    title = decodeURIComponent(noFragment);
  } catch {
    return null;
  }
  title = title.replace(/_/g, " ").trim();
  if (!title) return null;
  // Namespaced (File:, Help:, Category:, Wikipedia:, etc.) — not a readable article hop.
  if (/^[A-Z][a-z-]*:/.test(title) || title.includes(":")) return null;
  return title;
}

/** Extract inline spans (text + article links) from a run of inline HTML. */
function parseInline(html: string): TextSpan[] {
  const spans: TextSpan[] = [];
  // Walk anchors and the text between them. We only keep <a href> targets that resolve to an
  // article title; all other tags are stripped to their text content.
  const anchorRe = /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  const pushText = (raw: string) => {
    // Preserve boundary spaces between text runs and links (don't trim) so prose reads right.
    const text = decodeEntities(stripTags(raw));
    if (text.trim()) spans.push({ text });
  };
  while ((m = anchorRe.exec(html))) {
    if (m.index > last) pushText(html.slice(last, m.index));
    const title = hrefToTitle(m[1]);
    const label = decodeEntities(stripTags(m[2]).trim()); // link labels are trimmed
    if (label) {
      if (title) spans.push({ text: label, link: title });
      else spans.push({ text: label });
    }
    last = anchorRe.lastIndex;
  }
  if (last < html.length) pushText(html.slice(last));
  return mergeAdjacentText(spans);
}

/** Drop tags AND the full contents of script/style/sup, collapsing whitespace to single
    spaces. Does NOT trim — callers trim where appropriate (link labels), so inter-span
    boundary spaces are preserved for readable prose. */
function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "") // drop script CONTENT, not just tags
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "") // drop style content
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "") // drop reference markers [1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ");
}

/** Merge consecutive plain-text spans so the model is compact. */
function mergeAdjacentText(spans: TextSpan[]): TextSpan[] {
  const out: TextSpan[] = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    if (prev && !("link" in prev) && !("link" in s)) {
      out[out.length - 1] = { text: `${prev.text}${s.text}`.replace(/\s+/g, " ") };
    } else {
      out.push(s);
    }
  }
  return out;
}

const hasText = (spans: TextSpan[]) => spans.some((s) => s.text.trim().length > 0);

/**
 * Parse a Wikipedia REST `/page/html` document (or a section fragment) into safe blocks.
 * Only top-level <p>, <h2>, <h3> are kept; everything else is ignored. Reference/nav/edit
 * cruft is dropped. `title` is the article title (for display + link-back).
 */
export function parseArticleHtml(html: string, title: string): ArticleContent {
  const blocks: Block[] = [];
  // Grab paragraphs and section headings in document order.
  const blockRe = /<(p|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && blocks.length < MAX_BLOCKS) {
    const tag = m[1].toLowerCase();
    const inner = m[2];
    if (tag === "p") {
      const spans = parseInline(inner);
      // Skip empty paragraphs and coordinate/emptyish noise.
      if (hasText(spans)) blocks.push({ type: "paragraph", spans });
    } else {
      const spans = parseInline(inner);
      if (hasText(spans)) {
        blocks.push({ type: "heading", level: tag === "h2" ? 2 : 3, spans });
      }
    }
  }
  return { title, blocks };
}
