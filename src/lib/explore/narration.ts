/* Warren — optimistic "connective tissue" used before the LLM responds. The real bridges
   and titles come from the AI layer (see src/lib/ai/connective-tissue.ts), cached per
   (A→B); these deterministic templates are just the instant placeholder shown until the
   AI sentence/title arrives. They take a title resolver so they stay source-agnostic. */

/** A deterministic, generic bridge sentence shown instantly before the AI version loads.
    `titleOf` resolves an id (a live: id) to its display title. */
export function bridgeFor(
  fromId: string,
  toId: string,
  titleOf: (id: string) => string = (id) => id,
): string {
  const a = titleOf(fromId);
  const b = titleOf(toId);
  if (!a || !b) return "";
  const templates = [
    `A curious leap from ${a} to ${b} — two ideas that share more thread than you'd expect.`,
    `From ${a}, the trail bends toward ${b}, and the connection only looks obvious in hindsight.`,
    `What does ${a} have to do with ${b}? Follow the burrow and find out.`,
  ];
  // deterministic pick so the same jump always reads the same way
  const key = `${fromId}>${toId}`;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return templates[h % templates.length];
}

/** Templated journey title shown until the AI title arrives. `titleOf` resolves ids. */
export function titleFor(
  spineIds: string[],
  titleOf: (id: string) => string = (id) => id,
): string {
  if (!spineIds || spineIds.length < 2) {
    return spineIds && spineIds[0] ? titleOf(spineIds[0]) : "Untitled warren";
  }
  const first = spineIds[0];
  const last = spineIds[spineIds.length - 1];
  return `The ${titleOf(first)} to ${titleOf(last)} Run`;
}

export type Badge = { name: string; glyph: string };

/** Journey-shape badge from the spine + branch structure. */
export function badgeFor(
  spineIds: string[],
  allNodeCount: number,
): Badge | null {
  const n = spineIds.length;
  if (n < 2) return null;
  const last = spineIds[n - 1];
  const first = spineIds[0];
  if (last === first && n > 2) return { name: "The Loop", glyph: "↺" };
  const branchCount = allNodeCount - n;
  if (branchCount >= 4) return { name: "The Big Bang", glyph: "✳" };
  if (branchCount >= 2) return { name: "The Spiral", glyph: "✦" };
  if (n >= 5) return { name: "The Straight Shot", glyph: "→" };
  return { name: "The Burrow", glyph: "◦" };
}
