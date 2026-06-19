/* Warren — sample article corpus for the Explore-map prototype.
   Original, paraphrased encyclopedic blurbs (not copied from Wikipedia). This is a
   stand-in for the live Wikipedia/AI layer so the Explore screen is fully interactive
   without network calls. The famous demo journey is:
     Black hole → Spaghettification → Pasta → Ancient Rome. */

export type Article = {
  id: string;
  title: string;
  /** one-line summary */
  blurb: string;
  /** 2–4 sentence extract */
  extract: string;
  /** ids of articles you can burrow into from here */
  links: string[];
  /** placeholder caption for the lead-image strip */
  imgHint: string;
};

/** A node's category and color are ALWAYS derived from Wikipedia (no hardcoded taxonomy):
    the category string comes from /api/wiki/category, and the hue is a stable hash of that
    string — same category → same hue, for corpus and live nodes alike. Until a node's
    category resolves it carries this neutral placeholder. */
export const UNCATEGORIZED = "Topic";

/** Stable hue (0–360) hashed from an arbitrary category string. */
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Math.round(((h % 1000) / 1000) * 360);
}

export const hueOf = (cat: string): number => hueFromString(cat);

export const labelOf = (cat: string): string => cat;

export const START_ID = "black-hole";

export const ARTICLES: Article[] = [
  // ---- Physics / Astronomy ----
  {
    id: "black-hole",
    title: "Black hole",
    blurb: "A region of spacetime where gravity is so strong that nothing can escape.",
    extract:
      "A black hole is a region of spacetime in which gravity pulls so hard that not even light can break free. It forms when enough mass collapses into a small enough volume, folding spacetime around itself. The boundary of no return is called the event horizon, and at the centre theory predicts a singularity of unbounded density.",
    links: [
      "event-horizon",
      "spaghettification",
      "general-relativity",
      "singularity",
      "accretion-disk",
      "hawking-radiation",
    ],
    imgHint: "lead image · black hole",
  },
  {
    id: "event-horizon",
    title: "Event horizon",
    blurb: "The boundary beyond which events cannot affect an outside observer.",
    extract:
      "An event horizon is the surface surrounding a black hole from within which nothing can reach an outside observer. To a distant watcher, anything falling in appears to slow and freeze at the edge, reddening into darkness. Despite its drama, the horizon is not a physical wall but a one-way membrane in spacetime.",
    links: ["black-hole", "photon-sphere", "hawking-radiation", "spacetime"],
    imgHint: "lead image · event horizon",
  },
  {
    id: "spaghettification",
    title: "Spaghettification",
    blurb: "The vertical stretching of objects into long thin shapes by tidal forces.",
    extract:
      "Spaghettification is the playful name physicists give to the stretching of an object into a long, thin strand as it falls into a strong gravitational field. The pull on the near side vastly exceeds the pull on the far side, drawing matter out like a noodle. The very word borrows from the kitchen to describe one of the universe's most violent processes.",
    links: ["tidal-force", "black-hole", "pasta", "noodle"],
    imgHint: "lead image · stretched matter",
  },
  {
    id: "tidal-force",
    title: "Tidal force",
    blurb: "A differential gravitational pull across an extended body.",
    extract:
      "A tidal force arises because gravity weakens with distance, so different parts of a large body feel different pulls. The result is a stretching along one axis and a squeezing along the others. The same effect that raises Earth's ocean tides also tears apart matter near a black hole.",
    links: ["spaghettification", "moon", "ocean-tide"],
    imgHint: "lead image · tidal stretching",
  },
  {
    id: "general-relativity",
    title: "General relativity",
    blurb: "Einstein's geometric theory of gravitation as curved spacetime.",
    extract:
      "General relativity recasts gravity not as a force but as the curvature of spacetime produced by mass and energy. Objects simply follow the straightest possible paths through this curved geometry. The theory predicted black holes, the bending of starlight, and ripples called gravitational waves.",
    links: ["black-hole", "spacetime", "singularity"],
    imgHint: "lead image · curved spacetime",
  },
  {
    id: "singularity",
    title: "Gravitational singularity",
    blurb: "A point where a black hole's density and curvature become infinite.",
    extract:
      "A gravitational singularity is the point at the heart of a black hole where known physics breaks down and density appears to become infinite. Here the equations of general relativity stop giving sensible answers. Resolving what truly happens is thought to require a theory of quantum gravity we do not yet have.",
    links: ["black-hole", "general-relativity"],
    imgHint: "lead image · singularity",
  },
  {
    id: "accretion-disk",
    title: "Accretion disk",
    blurb: "A rotating disk of matter spiralling onto a massive central body.",
    extract:
      "An accretion disk is a flattened band of gas and dust that spirals inward toward a dense object such as a black hole or young star. Friction heats the infalling material until it blazes across the spectrum, often outshining whole galaxies. These disks are how we 'see' black holes that emit no light of their own.",
    links: ["black-hole", "event-horizon"],
    imgHint: "lead image · accretion disk",
  },
  {
    id: "hawking-radiation",
    title: "Hawking radiation",
    blurb: "Faint thermal radiation theorised to leak from black holes.",
    extract:
      "Hawking radiation is a slow trickle of particles predicted to escape from just outside a black hole's horizon. It implies black holes are not perfectly black but slowly evaporate over immense spans of time. The idea united gravity, quantum theory, and thermodynamics in a single startling sentence.",
    links: ["event-horizon", "black-hole"],
    imgHint: "lead image · horizon glow",
  },
  {
    id: "photon-sphere",
    title: "Photon sphere",
    blurb: "A region where gravity bends light into unstable circular orbits.",
    extract:
      "The photon sphere is a thin shell around a black hole where gravity is exactly strong enough to bend light into a circle. A beam aimed just right could, in principle, orbit and return to its source. It is the bright ring that frames the first images of a black hole's shadow.",
    links: ["event-horizon", "black-hole"],
    imgHint: "lead image · photon ring",
  },
  {
    id: "spacetime",
    title: "Spacetime",
    blurb: "The unified four-dimensional fabric of space and time.",
    extract:
      "Spacetime weaves the three dimensions of space together with time into a single four-dimensional continuum. Mass and energy bend this fabric, and that bending is what we feel as gravity. The notion replaced the idea of absolute, separate space and time that had stood since Newton.",
    links: ["general-relativity", "black-hole"],
    imgHint: "lead image · spacetime grid",
  },
  {
    id: "moon",
    title: "Moon",
    blurb: "Earth's only natural satellite and the brightest object in the night sky.",
    extract:
      "The Moon is Earth's single natural satellite, locked so that it always shows us the same face. Its gravity raises the twin bulges of the ocean tides and gently slows our planet's spin. It likely formed from debris flung out when a Mars-sized world struck the early Earth.",
    links: ["tidal-force", "ocean-tide"],
    imgHint: "lead image · the Moon",
  },
  {
    id: "ocean-tide",
    title: "Tide",
    blurb: "The regular rise and fall of sea levels caused by gravity.",
    extract:
      "Tides are the slow heartbeat of the oceans, rising and falling as the Moon and Sun tug on Earth's waters. Two bulges of water sweep around the planet each day as it rotates beneath them. Coastlines, navigators, and countless marine creatures all keep time by them.",
    links: ["moon", "tidal-force"],
    imgHint: "lead image · ocean tide",
  },

  // ---- Food ----
  {
    id: "pasta",
    title: "Pasta",
    blurb: "A staple of Italian cuisine made from unleavened durum wheat dough.",
    extract:
      "Pasta is a family of foods made by mixing durum wheat semolina with water or egg, then shaping and drying or boiling it. It comes in hundreds of forms, from threadlike strands to ridged tubes and folded parcels. Cheap, keepable, and endlessly versatile, it became one of the defining foods of the Italian table.",
    links: ["spaghetti", "durum-wheat", "italian-cuisine", "ancient-rome", "noodle"],
    imgHint: "lead image · dried pasta",
  },
  {
    id: "spaghetti",
    title: "Spaghetti",
    blurb: "Long, thin, cylindrical pasta — the archetypal Italian noodle.",
    extract:
      "Spaghetti is a long, thin, cylindrical pasta whose name comes from the Italian for 'little strings'. Traditionally rolled from durum wheat and water, it pairs with sauces from simple oil and garlic to slow-cooked ragù. Its tidy strands made it the pasta the rest of the world pictures first.",
    links: ["pasta", "italian-cuisine", "tomato"],
    imgHint: "lead image · spaghetti",
  },
  {
    id: "durum-wheat",
    title: "Durum wheat",
    blurb: "A hard wheat prized for pasta and semolina flour.",
    extract:
      "Durum is the hardest of the cultivated wheats, with a high protein content that gives dough its strength and bite. Milled coarsely it yields semolina, the golden flour at the heart of dried pasta. It thrives in the hot, dry summers of the Mediterranean basin.",
    links: ["pasta", "semolina", "italian-cuisine"],
    imgHint: "lead image · durum wheat",
  },
  {
    id: "semolina",
    title: "Semolina",
    blurb: "Coarse golden flour milled from durum wheat.",
    extract:
      "Semolina is the gritty, pale-gold flour produced when hard durum wheat is ground coarsely. Its high gluten content makes resilient dough that holds its shape when shaped and dried. Beyond pasta it thickens puddings and dusts the bottoms of baking loaves.",
    links: ["durum-wheat", "pasta"],
    imgHint: "lead image · semolina flour",
  },
  {
    id: "noodle",
    title: "Noodle",
    blurb: "An unleavened dough rolled flat and cut, then cooked in liquid.",
    extract:
      "A noodle is a strand or sheet of unleavened dough, boiled, fried, or bathed in broth. Versions appear independently across Asia and Europe, from hand-pulled wheat to rice and buckwheat. Long-distance trade carried techniques and tastes for them along routes like the Silk Road.",
    links: ["pasta", "spaghetti"],
    imgHint: "lead image · noodles",
  },
  {
    id: "italian-cuisine",
    title: "Italian cuisine",
    blurb: "The regional cooking traditions of the Italian peninsula.",
    extract:
      "Italian cuisine is less a single style than a patchwork of fiercely local traditions built on a few superb ingredients. Olive oil, wheat, tomatoes, and cheese recur from Alpine north to sun-baked south. Many of its rhythms — bread, wine, the shared table — reach back to ancient Rome.",
    links: ["pasta", "ancient-rome", "olive-oil", "tomato"],
    imgHint: "lead image · Italian table",
  },
  {
    id: "tomato",
    title: "Tomato",
    blurb: "A New World fruit that became central to Mediterranean cooking.",
    extract:
      "The tomato is a fruit native to the Americas that reached Europe only after the voyages of the sixteenth century. At first grown as an ornamental curiosity, it slowly conquered the southern Italian kitchen. Today it is hard to picture Italian food without it — a reminder of how recent some 'timeless' traditions are.",
    links: ["italian-cuisine", "spaghetti"],
    imgHint: "lead image · tomatoes",
  },
  {
    id: "olive-oil",
    title: "Olive oil",
    blurb: "A liquid fat pressed from olives, central to Mediterranean diets.",
    extract:
      "Olive oil is pressed from the fruit of the olive tree and has anointed Mediterranean cooking, lamps, and rituals for millennia. The Romans graded, traded, and shipped it across their empire in vast clay jars. Its flavours range from grassy and sharp to mellow and buttery depending on fruit and press.",
    links: ["italian-cuisine", "ancient-rome", "roman-cuisine"],
    imgHint: "lead image · olive oil",
  },

  // ---- History / Culture ----
  {
    id: "ancient-rome",
    title: "Ancient Rome",
    blurb: "A civilisation that grew from a city-state into a Mediterranean empire.",
    extract:
      "Ancient Rome began as a small settlement on the Tiber and grew, over centuries, into an empire ringing the Mediterranean. Its roads, law, language, and engineering shaped the western world long after the city's power faded. Roman tables, too, left their mark — wheat, oil, and wine were the staples of daily life.",
    links: ["roman-empire", "roman-cuisine", "latin", "colosseum", "appian-way"],
    imgHint: "lead image · Roman forum",
  },
  {
    id: "roman-empire",
    title: "Roman Empire",
    blurb: "The imperial phase of ancient Roman civilisation after the Republic.",
    extract:
      "The Roman Empire was the era when Rome was ruled by emperors, stretching at its height from Britain to the Persian Gulf. A common coinage, road network, and legal system bound together an astonishing diversity of peoples. Its slow transformation, rather than sudden fall, reshaped Europe for the next thousand years.",
    links: ["ancient-rome", "pax-romana", "latin", "appian-way"],
    imgHint: "lead image · Roman empire map",
  },
  {
    id: "roman-cuisine",
    title: "Ancient Roman cuisine",
    blurb: "The foods and dining customs of the ancient Roman world.",
    extract:
      "Roman cuisine ranged from the plain porridge of farmers to the spectacular banquets of the elite. Bread, olives, wine, and a pungent fermented fish sauce called garum flavoured nearly everything. The reclining dinner, or convivium, was as much about status and conversation as about the food.",
    links: ["ancient-rome", "olive-oil", "garum"],
    imgHint: "lead image · Roman banquet",
  },
  {
    id: "latin",
    title: "Latin",
    blurb: "The classical language of ancient Rome and parent of the Romance tongues.",
    extract:
      "Latin was the language of Rome, carried across its empire by soldiers, traders, and scribes. From its everyday spoken form grew Italian, Spanish, French, Portuguese, and Romanian. Long after it ceased to be anyone's mother tongue it remained the language of scholarship, law, and the church.",
    links: ["ancient-rome", "roman-empire"],
    imgHint: "lead image · Latin inscription",
  },
  {
    id: "colosseum",
    title: "Colosseum",
    blurb: "The vast amphitheatre at the heart of ancient Rome.",
    extract:
      "The Colosseum is the giant stone amphitheatre that still anchors the centre of Rome. Opened around 80 AD, it could seat tens of thousands for gladiatorial games and staged spectacles. Its tiers of arches became a model for stadiums built ever since.",
    links: ["ancient-rome", "roman-empire"],
    imgHint: "lead image · Colosseum",
  },
  {
    id: "garum",
    title: "Garum",
    blurb: "A fermented fish sauce that flavoured the ancient Roman kitchen.",
    extract:
      "Garum was a pungent sauce of fermented fish that the Romans splashed over almost every dish. Made by salting and curing fish in the sun, it delivered a deep savoury punch much like modern fish sauces of Southeast Asia. It was produced in seaside factories and shipped across the empire in sealed jars.",
    links: ["roman-cuisine", "ancient-rome"],
    imgHint: "lead image · garum jars",
  },
  {
    id: "appian-way",
    title: "Appian Way",
    blurb: "One of the earliest and most strategically vital Roman roads.",
    extract:
      "The Appian Way was among the first great Roman roads, begun in 312 BC to speed armies and trade south from Rome. Paved in tight-fitting stone, stretches of it still run arrow-straight across the countryside. 'All roads lead to Rome' began with engineering like this.",
    links: ["ancient-rome", "roman-empire"],
    imgHint: "lead image · Appian Way",
  },
  {
    id: "pax-romana",
    title: "Pax Romana",
    blurb: "A two-century span of relative peace across the Roman Empire.",
    extract:
      "The Pax Romana, or 'Roman Peace', was a roughly two-hundred-year stretch of relative stability across the empire beginning with Augustus. Trade, building, and travel flourished under a single law and currency. It is often cited as the high-water mark of Roman prosperity.",
    links: ["roman-empire", "ancient-rome"],
    imgHint: "lead image · Pax Romana",
  },
];

export const byId: Record<string, Article> = Object.fromEntries(
  ARTICLES.map((a) => [a.id, a]),
);
