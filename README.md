# Warren

Turn your Wikipedia rabbit hole into a beautiful, shareable map.

## Stack

- **Next.js 16** (App Router) on Vercel
- **TypeScript** + **Tailwind CSS v4**
- **Supabase** (Postgres + Auth) via `@supabase/ssr`
- **Anthropic Claude Haiku 4.5** for connective tissue, auto-titles, and guided tours
- **react-force-graph-2d** for the live map
- **@vercel/og** for share-card OG images
- **Wikimedia REST API** (`/page/summary`, `/page/related`) — proxied through our own API routes for User-Agent and caching control

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Layout

```
src/
  app/                 # Next.js App Router routes
  lib/
    env/               # zod-validated env loaders (server + public)
    wikipedia/         # Wikimedia REST proxy + cache
    ai/                # Anthropic client + prompt modules
    supabase/          # browser + server Supabase clients
    og/                # @vercel/og share-card renderers
  types/               # shared TypeScript types (Warren, Node, Edge, ...)
```
