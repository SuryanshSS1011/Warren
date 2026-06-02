# Warren — Story

The narrative. *Why* this exists, *who* it's for, and *how we tell it* to judges. For *what we build* see [BUILD_PLAN.md](BUILD_PLAN.md); for monetization specifics see [BUSINESS.md](BUSINESS.md).

---

## The one sentence

**"It's the only Wikipedia tool where your own messy 2am rabbit hole becomes a beautiful, titled, shareable map — and someone else can replay and continue your exact journey."**

That's the sentence a judge repeats to a colleague.

---

## The hook (15 seconds)

> *Over a gorgeous map animating:* "We all fall down Wikipedia rabbit holes and have nothing to show for it. Warren turns that into a map you can keep and share."

---

## Why now

**Wikipedia's top-of-funnel is softening — and that's the tailwind.**

Wikipedia had ~296B page views across all projects in 2024 (~130B on English Wikipedia). But per Marshall Miller, Sr Director of Product, Core Experiences at the Wikimedia Foundation (Diff blog, Oct 17, 2025):

> "We are seeing declines in human pageviews on Wikipedia over the past few months, amounting to a decrease of roughly 8% as compared to the same months in 2024… we believe that these declines reflect the impact of generative AI and social media on how people seek information."

**This is strategic context, not a counter-argument.** As AI answers replace destination reading, the *joy of exploration* becomes the differentiated reason to visit Wikipedia at all. **Warren sells the experience AI search is killing.**

Meanwhile, StumbleUpon nostalgia is driving renewed appetite for free-form discovery:
- Cloudhiker (~30,000 curated sites)
- Jumpstick, Discuvver
- r/InternetIsBeautiful (~16.6–17M members per GummySearch 2025 tracking)

Warren rides this cultural wave but anchors it to Wikipedia's trusted corpus and adds the structure (the map) the StumbleUpon clones lack.

---

## Competitive landscape — the gap is wide open

Every prior Wikipedia visualization treats the graph as a **static art object**, not a **living record of your journey**:

| Product | Got right | Got wrong | What we steal |
|---|---|---|---|
| **Six Degrees of Wikipedia** (Jacob Wenger) | Fast pathfinding, clean autosuggest | No reading, no journey, no share | Autosuggest start-article picker |
| **WikiGalaxy / Wikiverse** (Owen Cornec) | Stunning visuals, "fly through knowledge" | Pre-baked, not personal, reading bolted on | Node-birth delight, cluster coloring |
| **Wikitrivia / The Wiki Game / Wiki Speedrun** | Engaging mechanics | Games, not exploration | — |
| **Obsidian / Roam graph views** | Bidirectional link metaphor | Useless past ~200 nodes — "a tangled web that's more fun to look at than navigate." | DON'T just accumulate; encode meaning + focus |
| **Kumu.io / TheBrain** | Spatial navigation, focus+context | Enterprise-heavy, steep | Click-to-recenter focus pattern |
| **Wikiwand** | Better Wikipedia reading, AI layer (timelines, chat, fact-check) | Reader skin, no journey | Clean typography, hover previews |
| **Spotify Wrapped** | Designed-for-share, identity artifact | Annual only | The entire share-card philosophy |

**The unfilled gap:** nobody turns *your own* browsing session into an animated, AI-annotated, shareable map that doubles as a reusable knowledge artifact. **That is Warren.**

(Wikiwand context: founded 2013 in Tel Aviv by Lior Grossman and Ilan Lewin; launched Aug 2014; raised $600K in a single Aug 7, 2014 angel round from Saar Wilf, who became chairman. It's an adjacent niche, not Warren's.)

---

## Why a graph won't suck (the Obsidian lesson)

The single most important lesson from prior art: **a graph that just accumulates nodes becomes noise.**

Obsidian/Roam graph views are widely criticized as "beautiful and almost completely useless" past ~200 nodes. Warren's answer is **the spine + focus principle**:

- Your *actual clicked path* is a bright, thick, animated edge — the "spine."
- All other links are faint context.
- Recency, depth, and dwell time are encoded as separate visual channels (brightness, size, ring thickness).
- Clicked node recenters; neighbors highlight; distant nodes dim.

The graph never becomes a hairball because the user's narrative is *physically distinguished* from everything else.

---

## The artifact (designed first)

The lesson from Spotify Wrapped (and the *failure* of Wrapped Club): a share feature only works if (a) the shareable artifact is designed before the experience, (b) each frame has built-in bragging rights, (c) sharing is zero-friction. Wrapped slides are 9:16 by design for Stories/TikTok. Warren reverse-engineers from the share card inward.

**The Warren Share Card (sketch):**

> A dark, starfield-style card. A glowing curved trail snakes across it connecting 6–9 labeled nodes:
>
> **Black holes → Event horizon → Spaghettification → Pasta → Durum wheat → Ancient Rome.**
>
> Big auto-generated title at top: **"The Black Hole to Bolognese Run."**
>
> Footer stat strip: *9 hops · 4 categories · 17 min · deepest dive: ⭐⭐⭐⭐.*
>
> Small Warren logo + "replay this warren →" URL.

Optimal-distinctiveness baked in: the *shape* of your trail is uniquely yours (identity) but instantly legible to others (belonging).

**Sample connective-tissue sentence** (what the AI writes between two nodes):
> *Spaghettification → Pasta:* "The same word physicists borrowed to describe how gravity stretches matter into noodles near a black hole pulls us, fittingly, toward the real thing."

---

## The viral loop

```
Warren created → auto-titled → shared link unfurls beautifully (OG image)
                                      ↓
                            Friend clicks → replay animates
                                      ↓
                            Friend forks → continues exploring
                                      ↓
                            New warren created (loop closes)
```

Public gallery seeds the cold-start: "Featured Warrens" daily pick + "Trending today."

**Anti-features (deliberately omitted):** no comments, no public follower counts, no infinite feed. Warren is about exploration, not engagement-farming.

---

## LinkedIn build-in-public (the hackathon explicitly rewards tagging @Mind the Product)

What lands on LinkedIn in 2026 is the **journey + lesson**, not the brag.

**Post format:** short "Day N building Warren" + one GIF of the map animating + one honest learning.

> *Example:* "Today I learned force-directed graphs become unreadable past 100 nodes — here's how we fixed it with a 'spine'."

3–4 posts across the sprint. Tag @Mind the Product. Use `#EveryoneShipsNow`.

---

## Punch-above-weight micro-features

Cheap, delightful, memorable:

- **Tunnel Cam replay** — the animated playback of a shared warren. Already core; lean into it as a named feature.
- **Warren Tarot** — can't decide where to start? Draw 3 random intriguing articles (via REST `/page/random` + `/related`). Zero-friction onboarding + delight.
- **Journey-shape achievement badges** — *The Spiral*, *The Big Bang* (one start, many branches), *The Straight Shot*, *The Loop* (you came back where you started). Gamifies *what you already did* — the Wrapped lesson.
- **Auto-title personality** — witty AI titles are a share multiplier for free.
- *(Stretch)* **Audio commentary** — one-line TTS narration of your trail for the replay.

---

## Taglines (pick one, A/B the rest on LinkedIn)

- **"Map your curiosity."** — primary. Short, verb, memorable.
- "Every rabbit hole, mapped."
- "Wikipedia, as a journey."
- "Where the rabbit hole becomes the map."

---

## Demo video (2:30, map-hero product)

| Time | Beat |
|---|---|
| 0:00–0:15 | **Hook + elevator pitch.** Over a gorgeous map animating: "We all fall down Wikipedia rabbit holes…" Name + what it is in the first 10 seconds. |
| 0:15–1:15 | **Live demo, the hero.** Screen-record (60fps if possible) one beautiful journey: start at "Black holes," click through, nodes born, sentences fade in, burrow card reading. **Let it breathe** — don't rush. This is the "make judges sit up" moment. |
| 1:15–1:50 | **The payoff:** auto-title generating, share card rendering, link unfurling, replay animating. |
| 1:50–2:15 | **The business.** One clean line on the persona + $5/mo + Guided Tours; pricing page; one Novus dashboard insight you acted on. |
| 2:15–2:30 | **Close.** Tagline + URL. *"Warren. Map your curiosity. Try it at warren.app."* |

**Filming:** Screen Studio (or equivalent) for auto-zoom/pan polish. Tight written script — don't wing it; avoid generic AI scripts. Record voiceover separately and clean it. Show the product, not slides.

---

## Submission writeup template

- **What we built:** Warren turns Wikipedia browsing into a shareable visual journey; the live map is the product, reading happens inside it, AI explains every jump.
- **Who it's for:** lifelong learners / autodidacts who fall down rabbit holes — a $5/mo micro-SaaS.
- **Tools:** Next.js 16, Vercel, Supabase, react-force-graph, Claude Haiku 4.5 (Gemini Flash fallback), `@vercel/og`, Wikimedia REST API, Novus.ai.
- **What we learned:** the graph-legibility lesson, the designed-first share card, acting on a Novus insight.

---

## Hitting all 4 judging criteria (without being obvious)

| Criterion (25% each) | How we land it |
|---|---|
| **Product Thinking** | Persona, $5/mo model, and Guided Tours hook shown matter-of-factly in the business beat (see [BUSINESS.md](BUSINESS.md)). |
| **Craft & Execution** | Animation quality and reading-in-map polish speak for themselves in the demo. |
| **Originality & Ambition** | "Your-own-journey-as-artifact" framing + cross-lingual stretch. |
| **Shippedness** | Public URL a judge uses live + real Novus data + early submission. |

---

## The X-factor (the thing that sticks)

Most hackathon submissions are **clever**. Warren is **memorable** — it produces an artifact a judge will *want to share themselves*. The map is beautiful, but the share card is the wedge: a judge scrolls past it on X, recognizes the format, and thinks *"oh — I want one of those for my Wikipedia trail."*

That's the win condition: an entry that judges describe to a colleague the next day, not because it was technically impressive, but because the *shape of the product* lives in their head.

---

## Caveats (be honest in the writeup)

- **Market-size figures for "lifelong learning" vary wildly** ($8B self-paced e-learning to $485B broad lifelong education) — several reports are template placeholders. Use the Wikipedia-funnel framing and the proven $5–10/mo comparables (Readwise, Matter), not a single TAM number judges will see through.
- **Wikipedia human pageviews are declining ~8% YoY** (Miller, Wikimedia, Oct 2025) — frame as a tailwind (exploration is the differentiated value AI search can't replace) but be honest that top-of-funnel is softening.
- **Graph legibility past ~100 nodes is a documented, near-universal failure mode** (Obsidian/Roam) — the single most likely thing to make the product feel disappointing. The spine/focus design is essential, not optional.
- **The Pew "73%/74% lifelong learner" data is from 2016** — directionally still the best signal for the size of the curious-adult audience, but predates the current AI era; treat it as a floor.
