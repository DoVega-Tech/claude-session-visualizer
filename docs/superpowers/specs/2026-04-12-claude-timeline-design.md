# Claude Timeline — Design Spec

**Date:** 2026-04-12
**Status:** Approved for planning

## Purpose

A local web app that visualizes Claude Code sessions as a timeline, with an ElevenLabs-styled dashboard showing usage metrics and a drill-down session viewer with a timeline scrubber tied to a full transcript.

Single-user, runs via `npm run dev`, reads directly from `~/.claude/projects/<project>/<session>.jsonl`. No backend, no database.

## Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (built on Radix primitives) — Dialog, Popover, Select, Tabs, Tooltip, Slider, ScrollArea, Collapsible, etc.
- **Charts:** Recharts, styled to match ElevenLabs aesthetic
- **Aesthetic:** ElevenLabs-inspired — dark, spacious, restrained palette with one accent color, subtle gradients, clean sans + mono accents, generous whitespace
- **Syntax highlighting:** Shiki (SSR-friendly)
- **Testing:** Vitest + React Testing Library

## Architecture

No backend, no database. Server Components read the filesystem directly using `fs/promises`. Parsed data flows to Client Components for interactive charts and the timeline.

### Data layer (`lib/sessions/`)

- **`scanner.ts`** — enumerate project dirs and `.jsonl` files under `~/.claude/projects`, return lightweight metadata (path, mtime, size).
- **`parser.ts`** — stream-parse a single JSONL file line-by-line into a typed `Session`. Two modes: *metadata-only* (skips `messages[]`) for the dashboard, and *full* (includes `messages[]`) for the detail route.
- **`aggregator.ts`** — pure functions over `Session[]` that produce dashboard metrics (per-day buckets, tool-call counts, cost estimates, etc.).
- **`cache.ts`** — in-memory `Map` keyed by file path, invalidated by `mtime`. Module-level singleton (survives across requests in dev). Manual refresh button invalidates the entire cache.
- **`pricing.ts`** — model → per-token rate map. Unknown models render cost as `—` rather than guessing.

### Routes

- **`/`** — Dashboard: KPI cards, 8 metric charts, and a zoomed-out cross-project session timeline.
- **`/session/[projectId]/[sessionId]`** — Session detail: timeline scrubber + full transcript viewer.

## Data Model

```ts
type Session = {
  id: string              // filename without .jsonl
  projectId: string       // parent dir name (e.g. "-Users-felipevega-Desktop")
  projectLabel: string    // prettified ("~/Desktop")
  filePath: string
  startedAt: Date         // first message timestamp
  endedAt: Date           // last message timestamp
  durationMs: number
  model: string           // "claude-opus-4-6", etc.
  messageCount: number
  userTurns: number
  assistantTurns: number
  toolCalls: ToolCall[]   // { name, timestamp, durationMs? }
  tokens: {
    input: number
    output: number
    cacheCreate: number
    cacheRead: number
  }
  estimatedCostUsd: number  // derived from model + token counts
  partial?: boolean         // true if parser skipped malformed lines
  messages?: Message[]      // only loaded in detail view
}

type Message = {
  role: 'user' | 'assistant' | 'tool_result'
  timestamp: Date
  content: string           // text content
  toolName?: string         // if tool_use / tool_result
  toolInput?: unknown
  toolOutput?: unknown
}

type ToolCall = {
  name: string
  timestamp: Date
  durationMs?: number
}
```

**Two-tier loading:** Dashboard parses every session in *metadata-only* mode (no `messages[]`). Detail route loads the full `messages[]` for one session only. Keeps `/` fast even at thousands of sessions.

## Dashboard Layout (`/`)

ElevenLabs aesthetic: dark, spacious, restrained. Fewer things per row than a dense chart dashboard, larger charts, more negative space.

- **Header bar:** app title, date range picker (7d / 30d / 90d / all), project multi-select filter, Refresh button.
- **Row 1 — KPI cards (4 across):** Total sessions, Total tokens, Total cost, Active days streak.
- **Row 2 — Main charts (2 across):**
  - Sessions per day (stacked bar, colored by project)
  - Tokens per day (stacked area: input / output / cache-read / cache-create)
- **Row 3 — Secondary charts (3 across):**
  - Tool call frequency (horizontal bar, top 10)
  - Model usage over time (stacked area)
  - Avg session length (line, messages-per-session overlay)
- **Row 4 — Bottom strip:**
  - Cost per day (bar, per project stacked) — ~⅓ width
  - Activity heatmap (GitHub-style calendar) — ~⅔ width
- **Row 5 — Zoomed-out timeline:** full-width horizontal swimlane, one lane per project, session blocks positioned by time, width = duration, color-coded by model. Click a block → detail route. Brush/drag to zoom date range (re-filters everything above).

All charts are driven by the same filtered `Session[]`. Changing the date range or project filter recomputes everything.

## Session Detail (`/session/[projectId]/[sessionId]`)

- **Top bar:** breadcrumb (Project › Session id + start time), model badge, duration, token total, cost, Back button.
- **Upper half (~30% viewport) — Timeline scrubber:**
  - Horizontal track spanning full session duration.
  - Colored segments per message: user turn, assistant text, tool call (sub-colored by tool), tool result.
  - Hover → Radix Tooltip with snippet + timestamp + duration.
  - Click a segment → scrolls transcript below to that message and highlights it.
  - Mini-map underneath showing tool-call density.
- **Lower half — Transcript panel:**
  - shadcn `ScrollArea`, message bubbles.
  - User / assistant / tool-use / tool-result visually distinct (color + icon).
  - Tool calls are collapsible (Radix Collapsible) — collapsed by default showing `ToolName(summary)`; expand to see full input/output.
  - Code blocks syntax-highlighted via Shiki.
  - Each message has an anchor; the timeline drives scroll position.
- **Right sidebar (collapsible, ~280px):** session stats — token breakdown, tool-call counts, timing histogram. Can be hidden for more reading space.

## Error Handling

- **Malformed JSONL line** — skip with warning (file path + line number). One bad line never breaks a session.
- **Unknown schema fields** — ignored. Missing required fields → session marked `partial: true` with a warning badge.
- **Unknown model in pricing map** — cost renders as `—`, session still renders.
- **Empty `~/.claude/projects`** — friendly empty state explaining where sessions come from.
- **Permission denied / missing dir** — explicit error page with the path and the fix.
- **Very large sessions (>50MB JSONL)** — streamed line-by-line; detail route lazy-loads messages. Dashboard metadata parse never holds full content in memory.

## Testing

Vitest + React Testing Library.

- **Unit tests** for `parser.ts`, `aggregator.ts`, `pricing.ts`, and `cache.ts` invalidation — pure functions over fixture JSONL files in `test/fixtures/`.
- **Fixture set:** anonymized real sessions covering: normal, tool-heavy, malformed line, unknown model, empty session, very short session.
- **Component tests** for the timeline scrubber (segment positioning math) and one chart adapter.
- **No E2E** in v1. shadcn/Radix components are already tested upstream; manual browser smoke-test is sufficient.

## Out of Scope (v1)

Explicit YAGNI:

- Live file-watching / auto-refresh (manual Refresh button only)
- SQLite / persistent index (in-memory cache only)
- Cross-session search
- Tauri desktop packaging
- Export / sharing
- Editing the pricing map via UI (edit the file directly)
