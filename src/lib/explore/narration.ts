/* Warren — the "AI connective tissue" stand-in for the Explore prototype.
   Pre-written bridge sentences, witty auto-titles, and journey-shape badges. In the real
   product these come from the LLM (see src/lib/ai/connective-tissue.ts), cached per (A→B).
   Keeping them here lets the Explore screen run fully offline for the demo journey. */

import { byId } from "./corpus";

/** Pre-written bridges keyed "from>to". */
const BRIDGES: Record<string, string> = {
  "black-hole>spaghettification":
    "The same crushing gravity that defines a black hole has a vivid party trick: it stretches anything that falls in into a long, thin strand.",
  "black-hole>event-horizon":
    "Cross from the object itself to its point of no return — the invisible edge where the black hole writes its one rule: nothing leaves.",
  "black-hole>general-relativity":
    "To understand why a black hole bends everything around it, you step back into the theory that predicted it: gravity as the shape of spacetime.",
  "black-hole>singularity":
    "Fall all the way in, past the horizon, to the one place the equations refuse to answer — the infinitely dense heart.",
  "black-hole>accretion-disk":
    "We can't see the black hole itself, so we follow the blazing ring of doomed matter spiralling toward it.",
  "black-hole>hawking-radiation":
    "Even the ultimate trap may leak: a quiet quantum trickle that means black holes are not quite eternal.",
  "spaghettification>tidal-force":
    "Behind the noodle-stretching lies a plainer idea — gravity simply pulls harder on your near side than your far side.",
  "spaghettification>pasta":
    "Physicists named the universe's most violent stretching after a humble plate of long, thin strands. So let's follow the metaphor to the kitchen.",
  "spaghettification>noodle":
    "From cosmic stretching to the everyday strand it was named for — the noodle that lent its shape to a black hole's victims.",
  "tidal-force>moon":
    "The gentlest version of the same force that shreds matter near a black hole is the one the Moon uses to tug at our seas.",
  "tidal-force>ocean-tide":
    "Scale the stretching all the way down and you get something you can watch from a beach: the daily breathing of the tides.",
  "pasta>spaghetti":
    "Of all the shapes the dough can take, follow the one the world pictures first — the long, thin string.",
  "pasta>durum-wheat":
    "Every strand begins as a hard, golden grain bred to give the dough its backbone.",
  "pasta>italian-cuisine":
    "One staple opens onto a whole table — the regional traditions that made pasta a way of life.",
  "pasta>ancient-rome":
    "Before the modern plate there was the Roman one: wheat, oil, and wine on tables two thousand years old.",
  "pasta>noodle":
    "Pasta is one branch of a far older family tree of boiled dough that spans continents.",
  "durum-wheat>semolina":
    "Grind the hard grain coarsely and you get the golden flour at the heart of every dried strand.",
  "italian-cuisine>ancient-rome":
    "Trace the Italian table back far enough and you arrive in Rome, where bread, oil, and wine were already daily ritual.",
  "italian-cuisine>olive-oil":
    "No ingredient threads through this cuisine more completely than the green-gold oil pressed from olives.",
  "italian-cuisine>tomato":
    "The reddest staple of all turns out to be a recent arrival — a New World fruit that conquered the old kitchen.",
  "ancient-rome>roman-empire":
    "Follow the city-state forward into the era of emperors, when Rome ringed the whole Mediterranean.",
  "ancient-rome>roman-cuisine":
    "Step inside the dining room: what did Romans actually eat beneath all that marble?",
  "ancient-rome>latin":
    "The empire's most durable export wasn't roads or law but the language still hiding inside half of Europe's words.",
  "ancient-rome>colosseum":
    "For the spectacle at the empire's heart, there is one building everyone pictures.",
  "ancient-rome>appian-way":
    "If all roads led to Rome, this was the first and straightest of them.",
  "roman-cuisine>garum":
    "One sauce flavoured nearly everything Romans ate — a pungent, fermented secret.",
  "roman-cuisine>olive-oil":
    "The Roman pantry rested on a single golden staple poured over almost every dish.",
  "roman-empire>pax-romana":
    "At its calm height the empire enjoyed two centuries of relative peace — the famous Roman Peace.",
  "roman-empire>latin":
    "Binding this sprawl of peoples was a single administrative tongue carried by every legion.",
  "noodle>pasta":
    "Of all the world's boiled-dough cousins, follow the Italian branch that turned the strand into an art.",
  "moon>ocean-tide":
    "The Moon's most visible signature on Earth is the slow rise and fall it draws from the sea.",
  "general-relativity>spacetime":
    "At the centre of the theory sits one radical object: the four-dimensional fabric that mass can bend.",
  "general-relativity>black-hole":
    "Push the theory to its extreme and it predicts its own strangest creation — a place where spacetime folds shut.",
  "event-horizon>black-hole": "Step back from the edge to the object that casts it.",
  "event-horizon>photon-sphere":
    "Just outside the point of no return, light itself can be caught in a circle.",
  "event-horizon>hawking-radiation":
    "Right at the brink, quantum theory says the darkness should faintly glow.",
};

export function bridgeFor(fromId: string, toId: string): string {
  const key = `${fromId}>${toId}`;
  if (BRIDGES[key]) return BRIDGES[key];
  const rev = `${toId}>${fromId}`;
  if (BRIDGES[rev]) return BRIDGES[rev];
  const a = byId[fromId] || { title: fromId };
  const b = byId[toId] || { title: toId };
  const templates = [
    `A curious leap from ${a.title} to ${b.title} — two ideas that share more thread than you'd expect.`,
    `From ${a.title}, the trail bends toward ${b.title}, and the connection only looks obvious in hindsight.`,
    `What does ${a.title} have to do with ${b.title}? Follow the burrow and find out.`,
  ];
  // deterministic pick so the same jump always reads the same way
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return templates[h % templates.length];
}

/** Witty auto-titles keyed by "firstId>lastId"; templated fallback otherwise. */
const TITLES: Record<string, string> = {
  "black-hole>ancient-rome": "The Black Hole to Bolognese Run",
  "black-hole>roman-empire": "From Singularity to Senate",
  "black-hole>pasta": "Spacetime, Stretched into Spaghetti",
  "black-hole>spaghetti": "Spacetime, Stretched into Spaghetti",
  "black-hole>roman-cuisine": "Gravity to Garum",
  "black-hole>garum": "Gravity to Garum",
  "black-hole>latin": "Event Horizons & Etymologies",
  "black-hole>tomato": "Black Holes to Bruschetta",
  "black-hole>ocean-tide": "From the Abyss to the Shoreline",
  "black-hole>moon": "Pulled In by Gravity, All the Way Home",
};

export function titleFor(spineIds: string[]): string {
  if (!spineIds || spineIds.length < 1) return "Untitled warren";
  if (spineIds.length < 2) {
    const id = spineIds[0];
    return byId[id]?.title || id;
  }
  const first = spineIds[0];
  const last = spineIds[spineIds.length - 1];
  const key = `${first}>${last}`;
  if (TITLES[key]) return TITLES[key];
  const firstTitle = byId[first]?.title || first;
  const lastTitle = byId[last]?.title || last;
  return `The ${firstTitle} to ${lastTitle} Run`;
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
