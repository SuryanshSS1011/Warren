/* Warren — sample article corpus for the Explore-map prototype.
   Original, paraphrased encyclopedic blurbs (not copied from Wikipedia). This is a
   stand-in for the live Wikipedia/AI layer so the Explore screen is fully interactive
   without network calls. The famous demo journey is:
     Black hole → Spaghettification → Pasta → Ancient Rome. */

export type CategoryName =
  | "Culture and the arts"
  | "Geography and places"
  | "Health and fitness"
  | "History and events"
  | "Human activities"
  | "Mathematics and logic"
  | "Natural and physical sciences"
  | "People and self"
  | "Philosophy and thinking"
  | "Religion and belief systems"
  | "Society and social sciences"
  | "Technology"
  | "Physics" // Legacy
  | "Food" // Legacy
  | "History" // Legacy
  | "Culture" // Legacy
  | "Nature" // Legacy
  | "Language"; // Legacy

export type Article = {
  id: string;
  title: string;
  category: CategoryName;
  /** one-line summary */
  blurb: string;
  /** 2–4 sentence extract */
  extract: string;
  /** ids of articles you can burrow into from here */
  links: string[];
  /** placeholder caption for the lead-image strip */
  imgHint: string;
  /** User-captured highlights from Wikipedia */
  researchNotes?: string[];
};

/** Category → hue. Constant oklch lightness/chroma; only the hue varies. */
export const CATEGORIES: Record<CategoryName, { label: string; hue: number }> = {
  "Culture and the arts": { label: "Culture & Arts", hue: 330 },
  "Geography and places": { label: "Geography", hue: 150 },
  "Health and fitness": { label: "Health", hue: 190 },
  "History and events": { label: "History", hue: 26 },
  "Human activities": { label: "Activities", hue: 296 },
  "Mathematics and logic": { label: "Math", hue: 220 },
  "Natural and physical sciences": { label: "Science", hue: 256 },
  "People and self": { label: "People", hue: 350 },
  "Philosophy and thinking": { label: "Philosophy", hue: 280 },
  "Religion and belief systems": { label: "Religion", hue: 310 },
  "Society and social sciences": { label: "Society", hue: 200 },
  Technology: { label: "Technology", hue: 240 },
  // Legacy mappings for demo article compatibility
  Physics: { label: "Science", hue: 256 },
  Food: { label: "Food", hue: 72 },
  History: { label: "History", hue: 26 },
  Culture: { label: "Culture & Arts", hue: 330 },
  Nature: { label: "Geography", hue: 150 },
  Language: { label: "Activities", hue: 296 },
};

export const hueOf = (cat: string): number =>
  (CATEGORIES as Record<string, { hue: number }>)[cat]?.hue ?? 256;

export const labelOf = (cat: string): string =>
  (CATEGORIES as Record<string, { label: string }>)[cat]?.label ?? cat;

export const START_ID = "black-hole";

export const ARTICLES: Article[] = [
  // ---- Physics / Astronomy ----
  {
    id: "black-hole",
    title: "Black hole",
    category: "Natural and physical sciences",
    blurb: "A region of spacetime where gravity is so strong that nothing, not even light, can escape.",
    extract: "A black hole is formed when a massive star collapses at the end of its life cycle. The gravity is so intense because matter has been squeezed into a tiny space. This happens at the center of most galaxies, including our own.",
    links: ["spaghettification", "event-horizon", "general-relativity", "singularity", "accretion-disk", "hawking-radiation"],
    imgHint: "artist's impression · event horizon",
  },
  {
    id: "spaghettification",
    title: "Spaghettification",
    category: "Natural and physical sciences",
    blurb: "The vertical stretching and horizontal compression of objects into long thin shapes in a very strong gravitational field.",
    extract: "In astrophysics, spaghettification is the tidal effect caused by strong gravitational fields. Near a black hole, the gravity at your feet is much stronger than at your head, stretching you into a thin noodle.",
    links: ["black-hole", "tidal-force", "pasta", "noodle"],
    imgHint: "diagram · tidal stretching",
  },
  {
    id: "general-relativity",
    title: "General relativity",
    category: "Natural and physical sciences",
    blurb: "Einstein's geometric theory of gravitation as curved spacetime.",
    extract: "General relativity generalizes special relativity and Newton's law of universal gravitation, providing a unified description of gravity as a geometric property of space and time, or spacetime.",
    links: ["black-hole", "spacetime"],
    imgHint: "diagram · curved spacetime",
  },
  {
    id: "event-horizon",
    title: "Event horizon",
    category: "Natural and physical sciences",
    blurb: "The boundary around a black hole beyond which no events can affect an outside observer.",
    extract: "Often called the 'point of no return', the event horizon is the threshold where the escape velocity required to leave the black hole exceeds the speed of light.",
    links: ["black-hole", "photon-sphere", "hawking-radiation"],
    imgHint: "illustration · the brink",
  },
  {
    id: "singularity",
    title: "Gravitational singularity",
    category: "Natural and physical sciences",
    blurb: "A location in spacetime where the gravitational field becomes infinite.",
    extract: "At the center of a black hole lies the singularity, a point where density and gravity become infinite and the laws of physics as we know them cease to operate.",
    links: ["black-hole", "general-relativity"],
    imgHint: "abstract · infinite density",
  },
  {
    id: "accretion-disk",
    title: "Accretion disk",
    category: "Natural and physical sciences",
    blurb: "A rotating disk of matter formed by accretion around a massive central body.",
    extract: "As gas and dust spiral toward a black hole, they frictionally heat up and emit intense radiation, creating a glowing disk that makes the invisible black hole detectable.",
    links: ["black-hole", "tidal-force"],
    imgHint: "telescope image · glowing disk",
  },
  {
    id: "hawking-radiation",
    title: "Hawking radiation",
    category: "Natural and physical sciences",
    blurb: "Thermal radiation predicted to be released by black holes due to quantum effects.",
    extract: "Stephen Hawking showed that black holes aren't completely black but emit small amounts of thermal radiation, eventually causing them to evaporate over trillions of years.",
    links: ["black-hole", "event-horizon"],
    imgHint: "diagram · quantum evaporation",
  },
  {
    id: "tidal-force",
    title: "Tidal force",
    category: "Natural and physical sciences",
    blurb: "The effect of a gravitational field that stretches a body along the line towards the center of mass.",
    extract: "A tidal force is a secondary effect of the force of gravity; it is responsible for the tides, tidal locking, and the shredding of celestial bodies that wander too close to black holes.",
    links: ["spaghettification", "moon", "ocean-tide"],
    imgHint: "diagram · gravitational gradient",
  },

  // ---- Food & Cuisine ----
  {
    id: "pasta",
    title: "Pasta",
    category: "Culture and the arts",
    blurb: "A staple food of Italian cuisine, typically made from an unleavened dough of wheat flour mixed with water or eggs.",
    extract: "Pasta comes in hundreds of different shapes, from long strands like spaghetti to tubes like penne. It is usually boiled and served with a variety of sauces, reflecting regional Italian traditions.",
    links: ["spaghettification", "spaghetti", "durum-wheat", "italian-cuisine", "ancient-rome", "noodle"],
    imgHint: "photo · fresh fettuccine",
  },
  {
    id: "spaghetti",
    title: "Spaghetti",
    category: "Culture and the arts",
    blurb: "A long, thin, solid, cylindrical pasta.",
    extract: "Spaghetti is the most iconic form of pasta. It is a staple of traditional Italian cuisine and is famously paired with tomato sauce, meatballs, or simply olive oil and garlic.",
    links: ["pasta", "italian-cuisine"],
    imgHint: "photo · twirling spaghetti",
  },
  {
    id: "durum-wheat",
    title: "Durum wheat",
    category: "Natural and physical sciences",
    blurb: "A hard variety of wheat used especially to make semolina for pasta.",
    extract: "Durum is the hardest of all wheats. Its high protein content and strength make it ideal for pasta dough, allowing it to hold its shape during boiling.",
    links: ["pasta", "semolina"],
    imgHint: "photo · wheat stalks",
  },
  {
    id: "semolina",
    title: "Semolina",
    category: "Culture and the arts",
    blurb: "The coarse, purified wheat middlings of durum wheat.",
    extract: "Semolina is the essential ingredient for dry pasta. Its golden color and sandy texture provide the 'al dente' bite that defines quality Italian noodles.",
    links: ["durum-wheat", "pasta"],
    imgHint: "photo · golden flour",
  },
  {
    id: "italian-cuisine",
    title: "Italian cuisine",
    category: "Culture and the arts",
    blurb: "The deeply regional cooking traditions of Italy, known for their simplicity and high-quality ingredients.",
    extract: "Italian cuisine is characterized by its reliance on fresh, seasonal products like olive oil, cheese, and tomatoes. It is arguably the most popular and influential cuisine in the world.",
    links: ["pasta", "ancient-rome", "olive-oil", "tomato"],
    imgHint: "photo · tuscan table",
  },
  {
    id: "olive-oil",
    title: "Olive oil",
    category: "Culture and the arts",
    blurb: "A liquid fat obtained from olives, a traditional tree crop of the Mediterranean Basin.",
    extract: "Commonly used in cooking, olive oil is the backbone of the Mediterranean diet. It has been a staple of human civilization for thousands of years, used for food, fuel, and medicine.",
    links: ["italian-cuisine", "ancient-rome"],
    imgHint: "photo · green-gold oil",
  },
  {
    id: "tomato",
    title: "Tomato",
    category: "Nature",
    blurb: "The edible berry of the plant Solanum lycopersicum, often used as a vegetable ingredient.",
    extract: "While now a staple of Italian cooking, tomatoes are actually native to the Americas. they were brought to Europe in the 16th century and slowly transformed the continent's kitchens.",
    links: ["italian-cuisine"],
    imgHint: "photo · vine-ripened tomatoes",
  },

  // ---- History & Antiquity ----
  {
    id: "ancient-rome",
    title: "Ancient Rome",
    category: "History and events",
    blurb: "The civilization that grew from a small town on the Tiber River into an empire spanning the entire Mediterranean.",
    extract: "Rome's legacy includes its language (Latin), its laws, its architecture, and its engineering. At its peak, it was the most powerful and influential civilization in the Western world.",
    links: ["pasta", "roman-empire", "roman-cuisine", "latin", "colosseum", "appian-way"],
    imgHint: "photo · the Roman Forum",
  },
  {
    id: "roman-empire",
    title: "Roman Empire",
    category: "History and events",
    blurb: "The post-Republican period of ancient Rome, characterized by government by emperors.",
    extract: "The Empire reached its greatest extent under Trajan, controlling territory from Britain to Egypt. It provided a long period of relative stability known as the Pax Romana.",
    links: ["ancient-rome", "pax-romana", "latin"],
    imgHint: "map · mediterranean sprawl",
  },
  {
    id: "roman-cuisine",
    title: "Roman cuisine",
    category: "Culture and the arts",
    blurb: "The food and dining habits of ancient Romans, focusing on cereals, legumes, and fermented sauces.",
    extract: "Ancient Roman food was often heavily flavored with garum (fish sauce) and herbs. For the elite, banquets were a way to show off wealth through exotic ingredients and complex recipes.",
    links: ["ancient-rome", "garum", "olive-oil"],
    imgHint: "fresco · a Roman feast",
  },
  {
    id: "garum",
    title: "Garum",
    category: "Culture and the arts",
    blurb: "A fermented fish sauce used as a condiment in the cuisines of ancient Greece, Rome, and Carthage.",
    extract: "Garum was the salt of the ancient world. It was produced by fermenting fish innards in salt vats, resulting in a pungent, umami-rich liquid that appeared in almost every Roman recipe.",
    links: ["roman-cuisine", "olive-oil"],
    imgHint: "archaeology · amphorae",
  },
  {
    id: "pax-romana",
    title: "Pax Romana",
    category: "History and events",
    blurb: "A roughly 200-year-long period of relative peace and stability across the Roman Empire.",
    extract: "Beginning with Augustus, the Pax Romana was the high-water mark of Roman prosperity, allowing for unprecedented trade and the spread of Roman culture across three continents.",
    links: ["roman-empire", "ancient-rome"],
    imgHint: "lead image · Pax Romana",
  },
  {
    id: "latin",
    title: "Latin",
    category: "Human activities",
    blurb: "The classical language of ancient Rome, which became the ancestor of the Romance languages.",
    extract: "Latin was the administrative and military tongue of the Roman Empire. Long after the empire fell, it remained the international language of science, law, and the Church.",
    links: ["ancient-rome", "roman-empire"],
    imgHint: "photo · stone inscription",
  },
  {
    id: "colosseum",
    title: "Colosseum",
    category: "History and events",
    blurb: "An oval amphitheatre in the centre of the city of Rome, the largest ever built.",
    extract: "The Colosseum was used for gladiatorial contests and public spectacles. It stands as an iconic symbol of Imperial Rome and one of the greatest feats of Roman engineering.",
    links: ["ancient-rome"],
    imgHint: "photo · the Flavian Amphitheatre",
  },
  {
    id: "appian-way",
    title: "Appian Way",
    category: "History and events",
    blurb: "One of the earliest and most strategically important Roman roads of the ancient republic.",
    extract: "The Appian Way connected Rome to Brindisi. It was a masterpiece of paving, so well-built that parts of it are still in use today, two millennia later.",
    links: ["ancient-rome"],
    imgHint: "photo · ancient paving stones",
  },

  // ---- Misc / Cross-links ----
  {
    id: "noodle",
    title: "Noodle",
    category: "Culture and the arts",
    blurb: "A type of food made from unleavened dough which is rolled flat and cut into variety of shapes.",
    extract: "While often associated with Italy, noodles have ancient origins in China dating back 4,000 years. They are a universal comfort food found in nearly every culture on Earth.",
    links: ["spaghettification", "pasta"],
    imgHint: "photo · hand-pulled noodles",
  },
  {
    id: "moon",
    title: "Moon",
    category: "Natural and physical sciences",
    blurb: "Earth's only natural satellite and the fifth largest satellite in the Solar System.",
    extract: "The Moon is the brightest object in our night sky. Its gravitational pull is the primary cause of the ocean tides on Earth and has influenced human culture for ages.",
    links: ["tidal-force", "ocean-tide"],
    imgHint: "photo · lunar surface",
  },
  {
    id: "ocean-tide",
    title: "Ocean tide",
    category: "Natural and physical sciences",
    blurb: "The rise and fall of sea levels caused by the combined effects of the gravitational forces exerted by the Moon and the Sun.",
    extract: "Tides are the daily breathing of the world's oceans. They create unique ecosystems in the intertidal zone and have been used for navigation and power for centuries.",
    links: ["tidal-force", "moon"],
    imgHint: "photo · low tide at Mont Saint-Michel",
  },
  {
    id: "spacetime",
    title: "Spacetime",
    category: "Natural and physical sciences",
    blurb: "Any mathematical model that fuses the three dimensions of space and the one dimension of time into a single four-dimensional continuum.",
    extract: "In Einstein's universe, space and time are not separate stages but a single fabric that can be bent and warped by mass and energy.",
    links: ["general-relativity", "black-hole"],
    imgHint: "abstract · the fabric of reality",
  },
];

export const byId: Record<string, Article> = Object.fromEntries(
  ARTICLES.map((a) => [a.id, a]),
);

export const byTitle: Record<string, Article> = Object.fromEntries(
  ARTICLES.map((a) => [a.title, a]),
);
