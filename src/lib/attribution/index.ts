/**
 * Attribution engine — the legal foundation for every Wikipedia-derived and AI-generated
 * surface in Warren. See docs/PRODUCT_PLAN.md §1.1: treat every AI summary / connective-tissue
 * sentence as *potentially* derivative and carry attribution by default —
 *   (1) the source article title + hyperlink,
 *   (2) a "CC BY-SA 4.0" notice linked to the license,
 *   (3) an explicit "AI-generated / modified" flag.
 *
 * This module is the single source of truth for those constants and shapes. It has no
 * server-only imports so it can be used in both server (lib/ai, routes) and client
 * (components) code.
 */

export const CC_BY_SA_4_0 = {
  id: "CC-BY-SA-4.0",
  name: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;

export const WIKIPEDIA = {
  name: "Wikipedia",
  /** Nominative-use only. Warren must never imply Wikimedia affiliation — see PRODUCT_PLAN §1.2. */
  disclaimer:
    "Wikipedia is a trademark of the Wikimedia Foundation. Warren is not endorsed by or affiliated with the Wikimedia Foundation.",
} as const;

/** A single Wikipedia article that a Warren surface is derived from. */
export type Source = {
  title: string;
  url: string;
};

/**
 * Attribution stamped onto an AI-generated artifact (bridge sentence, narrative, title).
 * `generated: true` is the "AI-generated / modified" flag the UI must surface; `sources`
 * carries the per-article links that satisfy CC BY-SA attribution via link-back.
 */
export type AiAttribution = {
  generated: true;
  model: string;
  license: typeof CC_BY_SA_4_0;
  sources: Source[];
};

/** en.wikipedia.org article URL for a title, satisfying the CC BY-SA link-back requirement. */
export function wikipediaArticleUrl(title: string): string {
  const slug = title.trim().replace(/ /g, "_");
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(slug).replace(/%2F/g, "/")}`;
}

export function toSource(title: string): Source {
  return { title, url: wikipediaArticleUrl(title) };
}

/** Build the attribution stamp for an AI output derived from the given article titles. */
export function aiAttribution(model: string, sourceTitles: string[]): AiAttribution {
  return {
    generated: true,
    model,
    license: CC_BY_SA_4_0,
    sources: sourceTitles.map(toSource),
  };
}

/** An AI text output bundled with its attribution — the shape AI lib functions now return. */
export type AttributedText = {
  text: string;
  attribution: AiAttribution;
};
