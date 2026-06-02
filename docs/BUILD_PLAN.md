# Warren — Build Plan

The engineering plan. *What* we build and *how*. For *why* see [STORY.md](STORY.md); for monetization/persona see [BUSINESS.md](BUSINESS.md).

---

## Stack (final)

- **Frontend + API:** Next.js 16 App Router on Vercel. API routes proxy Wikipedia (controls User-Agent, caching), call the LLM, and render OG images.
- **Database:** Supabase (Postgres). Free tier (500MB DB, 50K MAU), built-in auth, relational fits warrens → nodes → edges.
- **Cache:** Vercel KV/Redis for Wikipedia summaries and AI `(A→B)` bridge sentences.
- **AI provider:** Claude Haiku 4.5 as default; Google Gemini 2.5 Flash as a one-env-flip fallback (`AI_PROVIDER=anthropic|gemini`).
- **Map:** `react-force-graph-2d` (canvas/WebGL). Built-in d3-force, node-birth animation, `linkDirectionalParticles` for the "tunnel" effect.
- **Share card:** `@vercel/og` (Satori) — JSX → SVG → PNG at the edge, ~1s, CDN-cached.
- **Auth:** Anonymous-first. Warrens stored in localStorage + Supabase under an anonymous id. "Sign in with Google" to claim/save beyond the 3-warren free limit.

**Defended alternatives:**
- *Sigma.js over react-force-graph?* No — Sigma is the king for thousands of static nodes; Warren's sessions are 10–200 nodes, where react-force-graph's React-native API + canvas animations give max delight per build hour. Sigma is the documented fallback if we ever need 500+ nodes.
- *Cytoscape.js?* Heavier to style/animate; not purpose-built for the "alive" force aesthetic.
- *Convex over Supabase?* Faster to start and great for realtime — only worth it if collaborative warrens become core. Supabase + Vercel is the safer hackathon bet.

---

## Performance budget

- First article rendered: **< 2.5s LCP**
- Map interactive: **< 3s TTI**
- New node added: **< 500ms perceived** — optimistic node render before the AI sentence resolves; sentence streams in after.

---

## Data layer (Wikimedia REST)

**Primary endpoints (all via our `/api/wiki/*` proxy):**
- `GET /page/summary/{title}` → `extract`, `extract_html`, `thumbnail`, `description`, `type`. Handles `standard`, `disambiguation`, `no-extract`, `redirect` transparently.
- `GET /page/related/{title}` → suggested next jumps + Warren Tarot.
- For clickable blue links inside an article, use Action API `action=parse` (or REST `/page/html`) and extract `<a href="/wiki/...">` links, filtering non-article namespaces (`File:`, `Help:`, etc.).

**Edge cases:**
| Case | Handling |
|---|---|
| Disambiguation | `type: "disambiguation"` → show chooser UI |
| Redirects | Handled transparently by RESTBase |
| Dead links / missing pages | `type: "no-extract"` or 404 → skip gracefully |
| No lead image | `thumbnail` absent → generated monogram tile |
| Long articles | Only ever fetch the summary extract, never full text |
| Non-English wikis | Swap the `en.` subdomain; `langlinks` gives cross-lingual equivalents (cross-lingual stretch) |

**Rate limits & etiquette — non-negotiable:**
- New Wikimedia global rate limits (2026) are per-user; respond to **429 with `Retry-After`** + exponential backoff.
- Limit concurrent requests to **≤ 3**.
- `User-Agent` is **mandatory** with contact info: `Warren/0.1 (https://warren.app; team@warren.app)`. In browser JS use the `Api-User-Agent` header. **Never hammer Wikimedia from the client** — always go through our proxy.
- Cache aggressively: edge cache + KV keyed by title. Use GET with `Accept-Encoding: gzip`.

---

## AI layer

**Cost-minimal payload:** send only the two article titles + their one-line `description` fields (optionally the first sentence of each summary). Never full body text. Relational reasoning needs concept identity, not body text.

- ~100–200 input tokens per call, ~30 output tokens.
- Claude Haiku 4.5: $1/M input, $5/M output, 200K context, prompt caching for ~90% input discount on the system prompt.
- Gemini 2.5 Flash: free tier (15 RPM, 1M tokens/day via AI Studio) — for failover and unauthenticated dev.

**Prompt patterns:**
- *Connective tissue:* "In one vivid sentence, explain the conceptual bridge a curious reader crosses going from [A: desc] to [B: desc]. Be specific and a little playful."
- *Auto-title:* "Give this knowledge journey a witty, shareable title like a Spotify Wrapped headline."
- *Guided Tours (paid):* "Plan a 7-hop path from [start] to [goal] via real Wikipedia articles. Output JSON: `{ hops: [{title, why}] }`."

**Cache every `(A→B)` pair** in KV so the same jump is never re-generated.

---

## Map UX (the hero)

**Library:** `react-force-graph-2d`. Canvas-rendered, React-native API.

**Scaling strategy by node count:**
| Range | Behavior |
|---|---|
| 0–50 | Full force layout, all labels visible |
| 50–150 | Labels on hover + on the "spine" (clicked path); side branches dim. Recency = brightness |
| 150–500 | Auto-cluster by Wikidata category color; collapse clusters into super-nodes you can expand. Camera auto-frames active region. Provide "fit to view" + minimap |

**The spine principle:** the user's *actual journey* is a bright, thick, animated path; every other link is faint context. Sidesteps the Obsidian/Roam hairball problem entirely.

**Reading inside the map (the hero requirement):** clicking a node expands it **in place** into a floating, scrollable "burrow" card — anchored to the node, layered above the canvas. Lead image, summary extract, blue links rendered as clickable chips. Clicking a chip spawns a new node with the node-birth animation and draws a directional-particle edge. Map never leaves the screen.

**Animations:**
- **Node-birth:** scale-from-0 + soft glow pulse on arrival.
- **Edge-draw:** directional particles travel source → target ("tunnel cam").
- **Force-settle:** gentle 600–900ms settle, then **kill the simulation alpha** — avoids the "nervous graph" anti-pattern.
- **Recenter:** smooth camera pan/zoom to the new node.

**Visual encodings — one channel per dimension (no clashes):**
| Channel | Encodes |
|---|---|
| Node size | Depth from start |
| Brightness / opacity | Recency |
| Ring thickness | Dwell time |
| Hue | Category (Wikidata "instance of") |
| Edge thickness | Spine vs. context |

---

## Persistence model (Supabase)

```
warren
  id uuid pk
  owner_id uuid null   -- null = anonymous (localStorage id)
  title text null
  started_at timestamptz
  is_public bool default false

node
  id uuid pk
  warren_id uuid fk
  wikipedia_title text
  description text null
  thumbnail text null
  category text null
  depth int
  created_at timestamptz
  dwell_ms int default 0

edge
  warren_id uuid fk
  source_node_id uuid fk
  target_node_id uuid fk
  bridge text null    -- AI connective tissue
  spine bool default false
  primary key (warren_id, source_node_id, target_node_id)
```

RLS: read public warrens for everyone; write only your own (owner_id = auth.uid()) or anonymous (matches a cookie-set anon id).

---

## Share card pipeline

`/w/[id]/og` → `@vercel/og` route returning a 1200×630 PNG:
- Dark starfield background
- Glowing curved trail through 6–9 labeled nodes (sampled from the warren's spine)
- Big auto-generated title
- Footer stat strip: `N hops · M categories · X min · deepest dive: ⭐⭐⭐⭐`
- Small Warren logo + `replay this warren →` URL

**Replay page (`/w/[id]`):** animates the journey playback — nodes born one by one, edges draw with particles, connective sentences fade in like subtitles. End screen: "Fork this warren" + "Start your own."

---

## Accessibility (must-have)

Force-directed graphs are screen-reader-hostile. Minimum bar:
1. Every warren has a **parallel text list / "table" view** — fully readable and keyboard-navigable. Doubles as the export format.
2. **ARIA live-region** announces each new node + its connective sentence.
3. Full keyboard nav: Tab through nodes, Enter to open burrow card.

---

## Mobile

Must work — most sharing happens on phones.
- Vertical map orientation
- Burrow card opens as bottom sheet (not floating overlay)
- Pinch-zoom for the map
- **Optimize mobile *viewing/replay***, not editing — shared links open there.
- Share card is the mobile hero artifact.

---

## Cross-lingual stretch ("Told Differently Around the World")

**Cuttable. Behind a Jun 12 go/no-go.** Only build if Stages 1–2 are polished.

- Eligible nodes show a badge: *"🌍 Told differently in 3 languages."*
- Hardcode 30–50 contested topics from the academic literature (Yasseri et al. 2014 *Most Controversial Topics in Wikipedia*; Johns Hopkins INFOGAP).
- Use `langlinks` to fetch the same article across editions; pull each edition's REST summary.
- Send 2–3 extracts to the LLM: "Summarize, neutrally and factually, how these encyclopedia summaries differ in framing/emphasis."
- UI: two/three columns with flags + extracts; below, a neutral AI "What differs" paragraph.
- **Risk controls:** curated topics only (never live-detected); neutral/descriptive/sourced tone enforced in the prompt; always link out to each Wikipedia edition; one-line disclaimer.

---

## Novus.ai / Pendo integration (eligibility-critical)

Two judges from Pendo/Novus → **P0**.

1. Sign up at novus.pendo.io (free open beta, no credit card).
2. Authorize **GitHub** and select the Warren repo.
3. Complete onboarding (role + goals).
4. Novus scans, builds Memory on top of Cortex, and **opens a PR installing instrumentation**.
5. Review and merge the PR (nothing merges automatically without approval).
6. Verify with `pendo.validateEnvironment()` in the browser console.

**Instrument:** article views, **link clicks (the core verb)**, dwell time per node, warren saves, **share clicks**, replay views, fork events, returns.

**Get this installed Jun 1–2.** Treat as a P0 eligibility gate.

---

## Schedule (team of 3, May 28 → Jun 20)

| Days | Dates | Goal |
|---|---|---|
| 1–2 | May 28–29 | Lock scope; brand + share-card design; Next.js + Supabase + Vercel skeleton; `react-force-graph` spike. **Connect GitHub → Novus.** |
| 3–5 | May 30–Jun 1 | Core loop: click article → fetch summary → render node → expand burrow → click blue link → new node. Wikipedia proxy + cache live. |
| 6–8 | Jun 2–4 | AI connective tissue + auto-title; spine/focus logic; node-birth + particle animations; recency/depth/dwell encodings. |
| 9–11 | Jun 5–7 | Save warren; share card via `@vercel/og`; replay page. **Internal "core done" demo to selves.** |
| 12–13 | Jun 8–9 | Fork; public gallery; auth (Google claim); Guided Tours paid prototype. Polish animations. |
| 14–15 | Jun 10–11 | Mobile + accessibility (text-list view, ARIA, keyboard); perf budget pass; pricing page. |
| **16** | **Jun 12** | **GO/NO-GO on cross-lingual.** If core is polished, build (16–17); else cut and polish. |
| 17–18 | Jun 13–14 | Cross-lingual (if go) OR deep polish + bug bash. Recruit 20–30 friends for real Novus data. |
| 19 | Jun 15 | Freeze features. Record demo video. Write submission. Capture Novus dashboard screenshots. |
| 20–22 | Jun 16–18 | Edit video; final QA; backup demo recording; LinkedIn launch posts; dry-run submission. |
| 23 | Jun 19 | **Submit (a day early).** Buffer for Devpost/upload issues. |
| — | Jun 20 5pm BST | Deadline — already submitted. |

**"Core done" checkpoint = end of Jun 7:** the full explore → read → annotate → save → share → replay loop works on a public URL.

---

## Staged thresholds

**Stage 1 (by Jun 7 — Core Done):** ship the loop on a public URL. **Threshold:** a stranger lands, clicks through 8+ articles, gets a share card. If not met, cut ALL stretch and polish only this loop.

**Stage 2 (Jun 8–11):** add fork, gallery, auth, Guided Tours prototype. **Threshold:** graph stays legible at 100 nodes (spine + focus working). If hairball, stop adding features.

**Stage 3 (Jun 12 go/no-go):** cross-lingual only if Stages 1–2 polished. **Threshold:** zero P0 bugs in the core loop. Otherwise cut.

**Always-on:** Novus installed and verified by Jun 2; real user data generated before Jun 15; submit by Jun 19.

---

## Risk register

| Risk | Likelihood | Mitigation | Fallback |
|---|---|---|---|
| Wikipedia 429 rate-limit | Med | ≤3 concurrent, server-side proxy, aggressive KV cache, valid User-Agent, exponential backoff | Pre-cache the demo journey's articles |
| AI cost/latency spike | Low | Haiku 4.5 cheap; cache every `(A→B)` pair; optimistic node render | `AI_PROVIDER=gemini` flip (already wired); ship node first, sentence streams in |
| **Graph unreadable >100 nodes** | **High** | Spine + focus/dim + clustering + fit-to-view | Cap session view; "summarize this warren" |
| Share card doesn't resonate | Med | Design it first; A/B titles | Lean on replay/fork delight instead |
| Deploy/site down at judging | Med | Submit early; staging + prod | **Pre-recorded backup demo** of the full flow |
| Cross-lingual controversy | Med | Curated topics, neutral sourced framing, disclaimer | Cut entirely (it's cuttable by design) |
| Demo flops / nerves | Med | Tight script, recorded not live | Use the recorded video as the demo |
| **Novus not installed correctly** | **High impact** | Install via GitHub Jun 1–2; verify with `validateEnvironment()`; screenshot early | Eligibility gate — P0 |

---

## Decision triggers (what would change the plan)

- If `react-force-graph` can't hit the animation-quality bar in the Day-2 spike → switch to hand-rolled d3-force + canvas (more control, more time). **Decide by end of Day 2.**
- If Anthropic API access is blocked → `AI_PROVIDER=gemini` immediately.
- If graph is still a hairball at 100 nodes after Stage 2 → halt feature work, fix legibility.
