/* Category color + label helpers. A node's category is ALWAYS derived from Wikipedia
   (no hardcoded taxonomy): the string comes from /api/wiki/category, and the hue is a
   stable hash of that string — same category → same hue. Until a node's category
   resolves it carries the neutral UNCATEGORIZED placeholder. */

export const UNCATEGORIZED = "Topic";

/** Stable hue (0–360) hashed from an arbitrary category string. */
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Math.round(((h % 1000) / 1000) * 360);
}

export const hueOf = (cat: string): number => hueFromString(cat);

export const labelOf = (cat: string): string => cat;

/** A short, friendly set of starter topics for the landing picker. These are plain
    Wikipedia article titles — NOT a corpus; they seed the first node, nothing more. */
export const STARTER_TOPICS: string[] = [
  "Black hole",
  "Roman Empire",
  "Octopus",
  "Jazz",
  "Volcano",
  "Cryptography",
  "Renaissance",
  "Mycelium",
];
