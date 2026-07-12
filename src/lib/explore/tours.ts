// Guided tours (Phase 7): hand-curated "start here" journeys — a warm on-ramp for new
// visitors and a growth/SEO surface. Just data: each tour seeds its first article (via the
// /?start= deep-link) and lists the thread so a reader knows where it goes. No infra.

export type Tour = {
  slug: string;
  title: string;
  blurb: string;
  glyph: string;
  /** ordered Wikipedia article titles — the intended thread (start = the first). */
  path: string[];
};

export const TOURS: Tour[] = [
  {
    slug: "zero-to-black-holes",
    title: "Zero to Black Holes",
    blurb: "From gravity to the edge of what light can escape.",
    glyph: "🕳️",
    path: ["Gravity", "General relativity", "Spacetime", "Event horizon", "Black hole"],
  },
  {
    slug: "how-jazz-happened",
    title: "How Jazz Happened",
    blurb: "Trace a sound from the blues to bebop and beyond.",
    glyph: "🎷",
    path: ["Blues", "Ragtime", "Jazz", "Bebop", "Miles Davis"],
  },
  {
    slug: "the-deep-sea",
    title: "Into the Deep Sea",
    blurb: "Descend from the surface into the strangest life on Earth.",
    glyph: "🦑",
    path: ["Ocean", "Deep sea", "Bioluminescence", "Anglerfish", "Giant squid"],
  },
  {
    slug: "birth-of-the-internet",
    title: "Birth of the Internet",
    blurb: "From packet switching to the web you're reading this on.",
    glyph: "🌐",
    path: ["Packet switching", "ARPANET", "Internet Protocol", "World Wide Web", "Hyperlink"],
  },
  {
    slug: "the-roman-machine",
    title: "The Roman Machine",
    blurb: "How a city became an empire — and how it ran.",
    glyph: "🏛️",
    path: ["Ancient Rome", "Roman Republic", "Roman Empire", "Roman aqueduct", "Roman law"],
  },
  {
    slug: "mind-and-brain",
    title: "Mind & Brain",
    blurb: "From a single neuron to consciousness itself.",
    glyph: "🧠",
    path: ["Neuron", "Synapse", "Brain", "Cognition", "Consciousness"],
  },
];

export function getTour(slug: string): Tour | undefined {
  return TOURS.find((t) => t.slug === slug);
}
