# RSS Feed Reader

Minimal RSS reader with dark terminal-style UI (shadcn + Tailwind).

## Run

```bash
bun install
bun dev
```

Open `http://localhost:3000`.

## Features

- Dark theme, terminal look (green/amber on black, monospace)
- shadcn-style Card, Button, ScrollArea
- Preloaded popular feeds: Hacker News, The Verge, Ars Technica, TechCrunch, The Information, The Block, Wired, Bloomberg Markets, BBC News, Reuters, Lobsters
- Three-panel layout: feed list → article list → article detail

## Stack

- Vite + React + TypeScript
- Tailwind CSS 4
- rss-parser (feeds fetched via CORS proxy)

## Deploy To Cloudflare Pages

This repo can be deployed to Cloudflare Pages.

- Build command: `bun run build`
- Build output directory: `dist`
- The RSS proxy is implemented for Pages in `/functions/api/feed.ts` (so `/api/feed` works in production)

### Notes

- The in-app chat (`/api/chat`) is currently implemented only in local Vite dev middleware (`vite.config.ts`)
- On Cloudflare Pages, the RSS reader works, but chat will not work unless you add a Pages Function for `/api/chat` and configure production auth/secrets
- Feed switching is cached client-side (memory + localStorage) and `/api/feed` is edge-cached in Cloudflare Pages for faster source switching
