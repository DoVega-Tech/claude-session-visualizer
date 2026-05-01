# Claude Session Visualizer

Local Next.js app that turns your Claude Code session JSONL files into a timeline dashboard.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The app reads `~/.claude/projects/*/*.jsonl` directly. No database, no backend. Sessions are cached in memory and invalidated by file mtime; click **Refresh** to force a re-scan.

## Test

```bash
npm test
```

## Stack

Next.js · TypeScript · Tailwind · shadcn/ui (Radix) · Recharts · Vitest.

## Pricing

Edit `lib/sessions/pricing.ts` to update per-model token rates.
