# RSS Feed Reader

Minimal RSS reader with dark terminal-style UI (shadcn + Tailwind).

## Run

```bash
bun install
bun dev
```

## Features

- Dark theme, terminal look (green/amber on black, monospace)
- shadcn-style Card, Button, ScrollArea
- Preloaded popular feeds: Hacker News, The Verge, Ars Technica, TechCrunch, The Information, The Block, Wired, Bloomberg Markets, BBC News, Reuters, Lobsters
- Three-panel layout: feed list → article list → article detail

## Stack

- Vite + React + TypeScript
- Tailwind CSS 4
- rss-parser (feeds fetched via CORS proxy)
