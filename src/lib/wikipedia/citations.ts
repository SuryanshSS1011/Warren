// Citation explorer (Phase 6b, Researcher tier). Extracts sourcing signals from the article
// HTML we already fetch — no new API, cheap by design. Surfaces the reference list, flags weak
// sources (self-published / user-generated / dead links) and unsourced-claim density
// ([citation needed]). Pure + framework-agnostic so it's easy to test.

export type Citation = {
  /** the external link the reference points to (first one found), if any */
  url?: string;
  /** the host of that url, e.g. "nytimes.com" */
  domain?: string;
  /** short reference text (trimmed) */
  text: string;
  /** heuristic weakness flags for this source */
  flags: CitationFlag[];
};

export type CitationFlag = "self-published" | "user-generated" | "dead-link" | "no-source";

export type CitationReport = {
  total: number;
  citationNeeded: number; // count of [citation needed]-style markers
  weak: number; // references with any weakness flag
  citations: Citation[];
};

// Domains that are generally weak/unreliable as encyclopedic sources (user-generated or
// self-published). Not exhaustive — a heuristic signal, not a verdict.
const USER_GENERATED = /(^|\.)(wikipedia\.org|wikimedia\.org|reddit\.com|quora\.com|medium\.com|fandom\.com|wikia\.com|youtube\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|pinterest\.com)$/i;
const SELF_PUBLISHED = /(^|\.)(blogspot\.|wordpress\.com|substack\.com|tumblr\.com|weebly\.com|wixsite\.com)/i;

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function flagsFor(url: string | undefined, text: string): CitationFlag[] {
  const flags: CitationFlag[] = [];
  if (!url) {
    flags.push("no-source");
    return flags;
  }
  const host = hostOf(url) ?? "";
  if (USER_GENERATED.test(host)) flags.push("user-generated");
  if (SELF_PUBLISHED.test(host)) flags.push("self-published");
  // Wikipedia marks known-dead links with this template text.
  if (/dead link|permanent dead link|link is dead/i.test(text)) flags.push("dead-link");
  return flags;
}

const firstUrl = (html: string): string | undefined =>
  /href="(https?:\/\/[^"]+)"/i.exec(html)?.[1];

const stripTags = (html: string) =>
  html
    // Drop script/style CONTENT (not just tags) so nothing executable-looking survives as text.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Parse citation signals from a Wikipedia REST `/page/html` document. Reads the reference
 * list (<cite> elements, or <li> under the references section) and counts unsourced-claim
 * markers. Caps the returned list to keep payloads small.
 */
export function parseCitations(html: string, limit = 100): CitationReport {
  // Unsourced-claim markers: "[citation needed]" and the class Wikipedia uses.
  const citationNeeded =
    (html.match(/\[\s*citation needed\s*\]/gi) ?? []).length +
    (html.match(/class="[^"]*\bnoprint\b[^"]*Template-Fact/gi) ?? []).length;

  const citations: Citation[] = [];
  // <cite ...>...</cite> is the standard reference wrapper in REST HTML.
  const citeRe = /<cite\b[^>]*>([\s\S]*?)<\/cite>/gi;
  let m: RegExpExecArray | null;
  while ((m = citeRe.exec(html)) && citations.length < limit) {
    const inner = m[1];
    const text = stripTags(inner);
    if (!text) continue;
    const url = firstUrl(inner);
    const domain = url ? hostOf(url) : undefined;
    citations.push({ url, domain, text: text.slice(0, 240), flags: flagsFor(url, text) });
  }

  const weak = citations.filter((c) => c.flags.length > 0).length;
  return { total: citations.length, citationNeeded, weak, citations };
}
