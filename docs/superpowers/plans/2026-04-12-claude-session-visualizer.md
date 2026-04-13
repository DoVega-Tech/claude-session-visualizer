# Claude Session Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js web app that reads Claude Code session JSONL files from `~/.claude/projects` and visualizes them as an ElevenLabs-styled dashboard plus a per-session timeline/transcript drill-down.

**Architecture:** Next.js 15 App Router, no backend, no database. Server Components read the filesystem directly. Pure-function data layer (`scanner` → `parser` → `aggregator`) with an in-memory mtime-invalidated cache. Two routes: `/` dashboard and `/session/[projectId]/[sessionId]` detail view.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (Radix), Recharts, Shiki, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-12-claude-timeline-design.md`

---

## File Structure

```
app/
  layout.tsx                          # Root layout, fonts, theme
  globals.css                         # Tailwind + design tokens
  page.tsx                            # Dashboard route (Server Component)
  session/[projectId]/[sessionId]/
    page.tsx                          # Session detail route
  not-found.tsx
  error.tsx
components/
  ui/                                 # shadcn components (generated)
  dashboard/
    header-bar.tsx                    # Date range, project filter, refresh
    kpi-cards.tsx
    charts/
      sessions-per-day.tsx
      tokens-per-day.tsx
      tool-frequency.tsx
      model-usage.tsx
      avg-session-length.tsx
      cost-per-day.tsx
      activity-heatmap.tsx
    swimlane-timeline.tsx             # Cross-project zoom-out timeline
    dashboard-client.tsx              # Holds filter state, renders all charts
  session/
    top-bar.tsx
    timeline-scrubber.tsx
    transcript-panel.tsx
    transcript-message.tsx
    session-sidebar.tsx
lib/
  sessions/
    types.ts                          # Session, Message, ToolCall, etc.
    pricing.ts                        # Model → per-token rates
    parser.ts                         # JSONL → Session (metadata | full)
    scanner.ts                        # Enumerate project dirs & files
    cache.ts                          # mtime-keyed in-memory cache
    aggregator.ts                     # Session[] → dashboard metrics
    paths.ts                          # CLAUDE_PROJECTS_DIR, label helpers
  utils.ts                            # cn() from shadcn
test/
  fixtures/
    normal.jsonl
    tool-heavy.jsonl
    malformed.jsonl
    unknown-model.jsonl
    empty.jsonl
    short.jsonl
  parser.test.ts
  aggregator.test.ts
  pricing.test.ts
  cache.test.ts
vitest.config.ts
tsconfig.json
tailwind.config.ts
postcss.config.mjs
next.config.ts
package.json
README.md
```

**Decomposition rationale:** `lib/sessions/*` are each one responsibility and independently testable. Charts are one-file-per-chart so each stays focused. Dashboard filter state lives in a single client component (`dashboard-client.tsx`) that wraps all charts; server component reads data once and passes it in.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components.json`, `lib/utils.ts`, `.gitignore`, `.nvmrc`

- [ ] **Step 1: Initialize Next.js + dependencies**

Run from `~/Desktop/claude-timeline`:

```bash
# Confirm we're in the repo root
pwd  # should be /Users/felipevega/Desktop/claude-timeline
ls   # should show docs/ and .git

# Create Next.js scaffold without prompts (writes into current dir)
npx --yes create-next-app@latest . \
  --ts --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --use-npm --no-turbopack --yes
```

Expected: package.json created, `app/`, `public/`, `next.config.ts`, `tailwind.config.ts` present.

- [ ] **Step 2: Install runtime deps**

```bash
npm install recharts date-fns clsx tailwind-merge class-variance-authority \
  lucide-react @radix-ui/react-slot shiki
```

- [ ] **Step 3: Install dev deps (Vitest + RTL)**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx --yes shadcn@latest init -d
```

When prompted (if any): style=default, base color=zinc, css variables=yes.

Expected: `components.json` and `lib/utils.ts` created.

- [ ] **Step 5: Add shadcn components we'll need**

```bash
npx --yes shadcn@latest add button card select popover tooltip scroll-area \
  tabs badge separator collapsible slider sheet dropdown-menu
```

Expected: files under `components/ui/` for each.

- [ ] **Step 6: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Add test script to `package.json` (edit the `scripts` block):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Smoke build**

```bash
npm run build
```

Expected: builds successfully with the default Next.js starter page.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "scaffold: Next.js + Tailwind + shadcn + Vitest"
```

---

## Task 2: Core types and paths helper

**Files:**
- Create: `lib/sessions/types.ts`, `lib/sessions/paths.ts`

- [ ] **Step 1: Write `lib/sessions/types.ts`**

```ts
export type MessageRole = 'user' | 'assistant' | 'tool_result' | 'system'

export interface ToolCall {
  name: string
  timestamp: Date
  durationMs?: number
}

export interface Message {
  uuid: string
  role: MessageRole
  timestamp: Date
  /** Plain text content for display. Tool blocks become stringified. */
  content: string
  /** Only set for tool_use / tool_result messages. */
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  /** True when the assistant block was a thinking block. */
  isThinking?: boolean
}

export interface SessionTokens {
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
}

/** Dashboard-mode session: everything except `messages[]`. */
export interface SessionMeta {
  id: string
  projectId: string
  projectLabel: string
  filePath: string
  startedAt: Date
  endedAt: Date
  durationMs: number
  model: string
  messageCount: number
  userTurns: number
  assistantTurns: number
  toolCalls: ToolCall[]
  tokens: SessionTokens
  estimatedCostUsd: number | null
  /** True if any line was skipped due to malformed JSON. */
  partial: boolean
}

/** Detail-mode session: meta + full message list. */
export interface Session extends SessionMeta {
  messages: Message[]
}
```

- [ ] **Step 2: Write `lib/sessions/paths.ts`**

```ts
import path from 'node:path'
import os from 'node:os'

export const CLAUDE_PROJECTS_DIR = path.join(
  os.homedir(),
  '.claude',
  'projects',
)

/**
 * Claude Code encodes cwd as a project dir name like
 * `-Users-felipevega-Desktop-my-app`. Turn it into `~/Desktop/my-app`.
 */
export function prettifyProjectId(projectId: string): string {
  if (!projectId.startsWith('-')) return projectId
  const asPath = projectId.replace(/-/g, '/')
  const home = os.homedir()
  if (asPath.startsWith(home)) return '~' + asPath.slice(home.length)
  return asPath
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/sessions/types.ts lib/sessions/paths.ts
git commit -m "feat(sessions): add types and paths helper"
```

---

## Task 3: Pricing module

**Files:**
- Create: `lib/sessions/pricing.ts`, `test/pricing.test.ts`

- [ ] **Step 1: Write the failing test** — `test/pricing.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { estimateCostUsd } from '@/lib/sessions/pricing'

describe('estimateCostUsd', () => {
  it('returns null for unknown models', () => {
    expect(
      estimateCostUsd('some-unknown-model', {
        input: 1000, output: 500, cacheCreate: 0, cacheRead: 0,
      }),
    ).toBeNull()
  })

  it('computes cost for claude-opus-4-6 from per-million rates', () => {
    // opus: $15/MTok in, $75/MTok out, $18.75 cache create, $1.50 cache read
    const cost = estimateCostUsd('claude-opus-4-6', {
      input: 1_000_000,
      output: 1_000_000,
      cacheCreate: 1_000_000,
      cacheRead: 1_000_000,
    })
    expect(cost).toBeCloseTo(15 + 75 + 18.75 + 1.5, 5)
  })

  it('scales linearly for partial token counts', () => {
    const cost = estimateCostUsd('claude-opus-4-6', {
      input: 500_000, output: 0, cacheCreate: 0, cacheRead: 0,
    })
    expect(cost).toBeCloseTo(7.5, 5)
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
npm test -- pricing
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/sessions/pricing.ts`**

```ts
import type { SessionTokens } from './types'

/** Rates in USD per 1,000,000 tokens. Extend as new models appear. */
export const MODEL_RATES: Record<
  string,
  { input: number; output: number; cacheCreate: number; cacheRead: number }
> = {
  'claude-opus-4-6':    { input: 15,  output: 75,  cacheCreate: 18.75, cacheRead: 1.5 },
  'claude-opus-4-5':    { input: 15,  output: 75,  cacheCreate: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-6':  { input: 3,   output: 15,  cacheCreate: 3.75,  cacheRead: 0.3 },
  'claude-sonnet-4-5':  { input: 3,   output: 15,  cacheCreate: 3.75,  cacheRead: 0.3 },
  'claude-haiku-4-5':   { input: 1,   output: 5,   cacheCreate: 1.25,  cacheRead: 0.1 },
}

export function estimateCostUsd(
  model: string,
  tokens: SessionTokens,
): number | null {
  // Strip version suffixes like "-20251001"
  const key = model.replace(/-\d{8}$/, '')
  const rate = MODEL_RATES[key]
  if (!rate) return null
  return (
    (tokens.input        * rate.input       ) / 1_000_000 +
    (tokens.output       * rate.output      ) / 1_000_000 +
    (tokens.cacheCreate  * rate.cacheCreate ) / 1_000_000 +
    (tokens.cacheRead    * rate.cacheRead   ) / 1_000_000
  )
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- pricing
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/pricing.ts test/pricing.test.ts
git commit -m "feat(sessions): pricing module with tests"
```

---

## Task 4: JSONL parser

**Files:**
- Create: `lib/sessions/parser.ts`, `test/fixtures/*.jsonl`, `test/parser.test.ts`

The parser reads a single JSONL file and returns a `Session` (full) or `SessionMeta`. It tolerates malformed lines and unknown top-level `type` values.

- [ ] **Step 1: Create fixture files under `test/fixtures/`**

`test/fixtures/normal.jsonl` — minimal well-formed 4-line session:

```jsonl
{"type":"user","uuid":"u1","timestamp":"2026-04-10T10:00:00.000Z","sessionId":"s","cwd":"/Users/x/proj","message":{"role":"user","content":"hi"}}
{"type":"assistant","uuid":"a1","timestamp":"2026-04-10T10:00:05.000Z","sessionId":"s","cwd":"/Users/x/proj","message":{"model":"claude-opus-4-6","content":[{"type":"text","text":"hello"}],"usage":{"input_tokens":10,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
{"type":"assistant","uuid":"a2","timestamp":"2026-04-10T10:00:10.000Z","sessionId":"s","cwd":"/Users/x/proj","message":{"model":"claude-opus-4-6","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls"}}],"usage":{"input_tokens":3,"output_tokens":8,"cache_creation_input_tokens":0,"cache_read_input_tokens":20}}}
{"type":"user","uuid":"u2","timestamp":"2026-04-10T10:00:11.000Z","sessionId":"s","cwd":"/Users/x/proj","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"file1\nfile2"}]}}
```

`test/fixtures/malformed.jsonl` — one good line, one garbage line, one good line:

```jsonl
{"type":"user","uuid":"u1","timestamp":"2026-04-10T10:00:00.000Z","sessionId":"s","cwd":"/x","message":{"role":"user","content":"hi"}}
{not valid json at all
{"type":"assistant","uuid":"a1","timestamp":"2026-04-10T10:00:05.000Z","sessionId":"s","cwd":"/x","message":{"model":"claude-opus-4-6","content":[{"type":"text","text":"ok"}],"usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
```

`test/fixtures/unknown-model.jsonl` — assistant with model not in pricing map:

```jsonl
{"type":"user","uuid":"u1","timestamp":"2026-04-10T10:00:00.000Z","sessionId":"s","cwd":"/x","message":{"role":"user","content":"hi"}}
{"type":"assistant","uuid":"a1","timestamp":"2026-04-10T10:00:05.000Z","sessionId":"s","cwd":"/x","message":{"model":"claude-experimental-999","content":[{"type":"text","text":"x"}],"usage":{"input_tokens":10,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
```

`test/fixtures/empty.jsonl` — literally empty file (zero bytes).

`test/fixtures/tool-heavy.jsonl` — 3 tool calls with different names:

```jsonl
{"type":"user","uuid":"u1","timestamp":"2026-04-10T10:00:00.000Z","sessionId":"s","cwd":"/x","message":{"role":"user","content":"go"}}
{"type":"assistant","uuid":"a1","timestamp":"2026-04-10T10:00:01.000Z","sessionId":"s","cwd":"/x","message":{"model":"claude-sonnet-4-6","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{}}],"usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
{"type":"assistant","uuid":"a2","timestamp":"2026-04-10T10:00:02.000Z","sessionId":"s","cwd":"/x","message":{"model":"claude-sonnet-4-6","content":[{"type":"tool_use","id":"t2","name":"Read","input":{}}],"usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
{"type":"assistant","uuid":"a3","timestamp":"2026-04-10T10:00:03.000Z","sessionId":"s","cwd":"/x","message":{"model":"claude-sonnet-4-6","content":[{"type":"tool_use","id":"t3","name":"Bash","input":{}}],"usage":{"input_tokens":1,"output_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}
```

- [ ] **Step 2: Write the failing tests** — `test/parser.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { parseSessionFile } from '@/lib/sessions/parser'

const fx = (name: string) => path.join(__dirname, 'fixtures', name)

describe('parseSessionFile — metadata mode', () => {
  it('parses a normal session', async () => {
    const s = await parseSessionFile(fx('normal.jsonl'), { mode: 'meta' })
    expect(s).not.toBeNull()
    expect(s!.messageCount).toBe(4)
    expect(s!.userTurns).toBe(2)
    expect(s!.assistantTurns).toBe(2)
    expect(s!.model).toBe('claude-opus-4-6')
    expect(s!.tokens.input).toBe(13)
    expect(s!.tokens.output).toBe(13)
    expect(s!.tokens.cacheRead).toBe(20)
    expect(s!.toolCalls).toHaveLength(1)
    expect(s!.toolCalls[0].name).toBe('Bash')
    expect(s!.startedAt.toISOString()).toBe('2026-04-10T10:00:00.000Z')
    expect(s!.endedAt.toISOString()).toBe('2026-04-10T10:00:11.000Z')
    expect(s!.durationMs).toBe(11_000)
    expect(s!.estimatedCostUsd).toBeGreaterThan(0)
    expect(s!.partial).toBe(false)
  })

  it('marks session partial and skips malformed lines', async () => {
    const s = await parseSessionFile(fx('malformed.jsonl'), { mode: 'meta' })
    expect(s).not.toBeNull()
    expect(s!.partial).toBe(true)
    expect(s!.messageCount).toBe(2)
  })

  it('returns estimatedCostUsd=null for unknown model', async () => {
    const s = await parseSessionFile(fx('unknown-model.jsonl'), { mode: 'meta' })
    expect(s!.estimatedCostUsd).toBeNull()
  })

  it('returns null for empty file', async () => {
    const s = await parseSessionFile(fx('empty.jsonl'), { mode: 'meta' })
    expect(s).toBeNull()
  })

  it('counts tool calls per name', async () => {
    const s = await parseSessionFile(fx('tool-heavy.jsonl'), { mode: 'meta' })
    const names = s!.toolCalls.map(t => t.name).sort()
    expect(names).toEqual(['Bash', 'Bash', 'Read'])
  })
})

describe('parseSessionFile — full mode', () => {
  it('includes message array', async () => {
    const s = await parseSessionFile(fx('normal.jsonl'), { mode: 'full' })
    expect(s).not.toBeNull()
    expect('messages' in s!).toBe(true)
    // @ts-expect-error narrowed
    expect(s.messages).toHaveLength(4)
  })
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
npm test -- parser
```

Expected: FAIL (parseSessionFile not found).

- [ ] **Step 4: Implement `lib/sessions/parser.ts`**

```ts
import fs from 'node:fs'
import readline from 'node:readline'
import path from 'node:path'
import type {
  Session, SessionMeta, Message, ToolCall, SessionTokens, MessageRole,
} from './types'
import { estimateCostUsd } from './pricing'
import { prettifyProjectId } from './paths'

export interface ParseOptions {
  mode: 'meta' | 'full'
}

interface RawLine {
  type?: string
  uuid?: string
  timestamp?: string
  message?: {
    role?: string
    model?: string
    content?: unknown
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

/** Extract readable text from a content block array or string. */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((c: any) => {
      if (!c || typeof c !== 'object') return ''
      if (c.type === 'text') return c.text ?? ''
      if (c.type === 'thinking') return c.thinking ?? ''
      if (c.type === 'tool_use')
        return `[tool_use:${c.name ?? 'unknown'}]`
      if (c.type === 'tool_result')
        return typeof c.content === 'string' ? c.content : JSON.stringify(c.content ?? '')
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export async function parseSessionFile(
  filePath: string,
  opts: ParseOptions,
): Promise<Session | SessionMeta | null> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  const messages: Message[] = []
  const toolCalls: ToolCall[] = []
  const tokens: SessionTokens = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }

  let model = ''
  let startedAt: Date | null = null
  let endedAt: Date | null = null
  let userTurns = 0
  let assistantTurns = 0
  let partial = false

  for await (const raw of rl) {
    if (!raw.trim()) continue
    let line: RawLine
    try {
      line = JSON.parse(raw)
    } catch {
      partial = true
      continue
    }

    if (line.type !== 'user' && line.type !== 'assistant' && line.type !== 'system') {
      continue // ignore progress/permission-mode/etc
    }

    const ts = line.timestamp ? new Date(line.timestamp) : null
    if (!ts || isNaN(ts.getTime())) {
      partial = true
      continue
    }
    if (!startedAt || ts < startedAt) startedAt = ts
    if (!endedAt || ts > endedAt) endedAt = ts

    const msg = line.message ?? {}
    const role: MessageRole =
      line.type === 'system'
        ? 'system'
        : line.type === 'assistant'
          ? 'assistant'
          : 'user'

    if (role === 'user') userTurns++
    if (role === 'assistant') assistantTurns++

    if (msg.model && !model) model = msg.model

    if (msg.usage) {
      tokens.input        += msg.usage.input_tokens ?? 0
      tokens.output       += msg.usage.output_tokens ?? 0
      tokens.cacheCreate  += msg.usage.cache_creation_input_tokens ?? 0
      tokens.cacheRead    += msg.usage.cache_read_input_tokens ?? 0
    }

    // Collect tool calls from assistant content blocks
    if (Array.isArray(msg.content)) {
      for (const c of msg.content as any[]) {
        if (c?.type === 'tool_use') {
          toolCalls.push({ name: c.name ?? 'unknown', timestamp: ts })
        }
      }
    }

    if (opts.mode === 'full') {
      // Emit one message per content block so the transcript view is granular
      if (Array.isArray(msg.content)) {
        for (const c of msg.content as any[]) {
          if (!c || typeof c !== 'object') continue
          if (c.type === 'tool_use') {
            messages.push({
              uuid: `${line.uuid}:${c.id ?? messages.length}`,
              role: 'assistant',
              timestamp: ts,
              content: `[tool_use:${c.name}]`,
              toolName: c.name,
              toolInput: c.input,
            })
          } else if (c.type === 'tool_result') {
            messages.push({
              uuid: `${line.uuid}:r${messages.length}`,
              role: 'tool_result',
              timestamp: ts,
              content: typeof c.content === 'string'
                ? c.content
                : JSON.stringify(c.content ?? ''),
              toolOutput: c.content,
            })
          } else if (c.type === 'text') {
            messages.push({
              uuid: `${line.uuid}:t${messages.length}`,
              role,
              timestamp: ts,
              content: c.text ?? '',
            })
          } else if (c.type === 'thinking') {
            messages.push({
              uuid: `${line.uuid}:think${messages.length}`,
              role: 'assistant',
              timestamp: ts,
              content: c.thinking ?? '',
              isThinking: true,
            })
          }
        }
      } else {
        messages.push({
          uuid: line.uuid ?? String(messages.length),
          role,
          timestamp: ts,
          content: contentToText(msg.content),
        })
      }
    } else {
      // meta mode: still need a count; push a stub (not retained)
      messages.push({
        uuid: line.uuid ?? '',
        role,
        timestamp: ts,
        content: '',
      })
    }
  }

  if (!startedAt || !endedAt) return null

  const projectId = path.basename(path.dirname(filePath))
  const id = path.basename(filePath, '.jsonl')

  const meta: SessionMeta = {
    id,
    projectId,
    projectLabel: prettifyProjectId(projectId),
    filePath,
    startedAt,
    endedAt,
    durationMs: endedAt.getTime() - startedAt.getTime(),
    model: model || 'unknown',
    messageCount: messages.length,
    userTurns,
    assistantTurns,
    toolCalls,
    tokens,
    estimatedCostUsd: estimateCostUsd(model || 'unknown', tokens),
    partial,
  }

  if (opts.mode === 'full') {
    return { ...meta, messages } as Session
  }
  return meta
}
```

- [ ] **Step 5: Run parser tests and confirm they pass**

```bash
npm test -- parser
```

Expected: all parser tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/sessions/parser.ts test/parser.test.ts test/fixtures
git commit -m "feat(sessions): JSONL parser with fixtures and tests"
```

---

## Task 5: Scanner

**Files:**
- Create: `lib/sessions/scanner.ts`, `test/scanner.test.ts`

- [ ] **Step 1: Write the failing test** — `test/scanner.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { scanProjectsDir } from '@/lib/sessions/scanner'

describe('scanProjectsDir', () => {
  it('returns empty array when dir does not exist', async () => {
    const result = await scanProjectsDir('/nonexistent/path/abc123')
    expect(result).toEqual([])
  })

  it('enumerates jsonl files across project subdirs', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-'))
    await fs.mkdir(path.join(tmp, '-Users-x-proj'), { recursive: true })
    await fs.writeFile(path.join(tmp, '-Users-x-proj', 'abc.jsonl'), '')
    await fs.writeFile(path.join(tmp, '-Users-x-proj', 'def.jsonl'), '')
    await fs.mkdir(path.join(tmp, '-Users-x-other'), { recursive: true })
    await fs.writeFile(path.join(tmp, '-Users-x-other', 'xyz.jsonl'), '')
    // a non-jsonl file that should be ignored
    await fs.writeFile(path.join(tmp, '-Users-x-proj', 'notes.txt'), '')

    const result = await scanProjectsDir(tmp)
    expect(result).toHaveLength(3)
    expect(result.every(r => r.filePath.endsWith('.jsonl'))).toBe(true)
    expect(result.every(r => typeof r.mtimeMs === 'number')).toBe(true)

    await fs.rm(tmp, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: Run and confirm fails**

```bash
npm test -- scanner
```

- [ ] **Step 3: Implement `lib/sessions/scanner.ts`**

```ts
import fs from 'node:fs/promises'
import path from 'node:path'

export interface ScannedFile {
  projectId: string
  sessionId: string
  filePath: string
  mtimeMs: number
  sizeBytes: number
}

export async function scanProjectsDir(root: string): Promise<ScannedFile[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(root)
  } catch {
    return []
  }

  const results: ScannedFile[] = []
  for (const entry of entries) {
    const projectDir = path.join(root, entry)
    let stat
    try {
      stat = await fs.stat(projectDir)
    } catch { continue }
    if (!stat.isDirectory()) continue

    let files: string[]
    try {
      files = await fs.readdir(projectDir)
    } catch { continue }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const filePath = path.join(projectDir, file)
      try {
        const s = await fs.stat(filePath)
        if (!s.isFile()) continue
        results.push({
          projectId: entry,
          sessionId: file.replace(/\.jsonl$/, ''),
          filePath,
          mtimeMs: s.mtimeMs,
          sizeBytes: s.size,
        })
      } catch { /* skip unreadable file */ }
    }
  }
  return results
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm test -- scanner
```

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/scanner.ts test/scanner.test.ts
git commit -m "feat(sessions): filesystem scanner with tests"
```

---

## Task 6: mtime-invalidated cache

**Files:**
- Create: `lib/sessions/cache.ts`, `test/cache.test.ts`

- [ ] **Step 1: Write the failing test** — `test/cache.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionCache } from '@/lib/sessions/cache'
import type { SessionMeta } from '@/lib/sessions/types'

function makeMeta(id: string): SessionMeta {
  return {
    id, projectId: 'p', projectLabel: 'p', filePath: `/fake/${id}.jsonl`,
    startedAt: new Date(0), endedAt: new Date(0), durationMs: 0,
    model: 'claude-opus-4-6', messageCount: 0, userTurns: 0, assistantTurns: 0,
    toolCalls: [],
    tokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    estimatedCostUsd: 0, partial: false,
  }
}

describe('SessionCache', () => {
  let cache: SessionCache
  beforeEach(() => { cache = new SessionCache() })

  it('returns undefined on miss', () => {
    expect(cache.get('/x', 1000)).toBeUndefined()
  })

  it('returns value on hit with same mtime', () => {
    const m = makeMeta('a')
    cache.set('/x', 1000, m)
    expect(cache.get('/x', 1000)).toBe(m)
  })

  it('treats newer mtime as miss', () => {
    cache.set('/x', 1000, makeMeta('a'))
    expect(cache.get('/x', 2000)).toBeUndefined()
  })

  it('clear() empties the cache', () => {
    cache.set('/x', 1000, makeMeta('a'))
    cache.clear()
    expect(cache.get('/x', 1000)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- cache
```

- [ ] **Step 3: Implement `lib/sessions/cache.ts`**

```ts
import type { SessionMeta } from './types'

interface Entry { mtimeMs: number; meta: SessionMeta }

export class SessionCache {
  private map = new Map<string, Entry>()

  get(filePath: string, mtimeMs: number): SessionMeta | undefined {
    const entry = this.map.get(filePath)
    if (!entry) return undefined
    if (entry.mtimeMs !== mtimeMs) return undefined
    return entry.meta
  }

  set(filePath: string, mtimeMs: number, meta: SessionMeta): void {
    this.map.set(filePath, { mtimeMs, meta })
  }

  clear(): void { this.map.clear() }

  size(): number { return this.map.size }
}

/** Module-level singleton for server components to share across requests. */
export const sessionCache = new SessionCache()
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm test -- cache
```

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/cache.ts test/cache.test.ts
git commit -m "feat(sessions): mtime-invalidated cache"
```

---

## Task 7: Aggregator

**Files:**
- Create: `lib/sessions/aggregator.ts`, `test/aggregator.test.ts`

Aggregator takes `SessionMeta[]` and produces chart-ready shapes. Pure functions, easy to test.

- [ ] **Step 1: Write failing tests** — `test/aggregator.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import {
  totalsKpi, sessionsPerDay, tokensPerDay, toolFrequency,
  modelUsageOverTime, avgSessionLength, costPerDay, activityHeatmap,
} from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'

function mk(opts: Partial<SessionMeta> & { day: string }): SessionMeta {
  const start = new Date(`${opts.day}T10:00:00Z`)
  return {
    id: opts.id ?? 'x', projectId: opts.projectId ?? 'p', projectLabel: 'p',
    filePath: '/x', startedAt: start, endedAt: new Date(start.getTime() + 60_000),
    durationMs: 60_000, model: opts.model ?? 'claude-opus-4-6',
    messageCount: opts.messageCount ?? 10, userTurns: 5, assistantTurns: 5,
    toolCalls: opts.toolCalls ?? [],
    tokens: opts.tokens ?? { input: 100, output: 50, cacheCreate: 0, cacheRead: 200 },
    estimatedCostUsd: opts.estimatedCostUsd ?? 0.01,
    partial: false,
  }
}

describe('aggregator', () => {
  const sessions: SessionMeta[] = [
    mk({ day: '2026-04-10', id: 's1', projectId: 'p1',
      toolCalls: [{ name: 'Bash', timestamp: new Date() }, { name: 'Read', timestamp: new Date() }] }),
    mk({ day: '2026-04-10', id: 's2', projectId: 'p2',
      toolCalls: [{ name: 'Bash', timestamp: new Date() }] }),
    mk({ day: '2026-04-11', id: 's3', projectId: 'p1',
      model: 'claude-sonnet-4-6',
      toolCalls: [{ name: 'Edit', timestamp: new Date() }] }),
  ]

  it('totalsKpi sums across sessions', () => {
    const t = totalsKpi(sessions)
    expect(t.sessionCount).toBe(3)
    expect(t.totalTokens).toBe((100 + 50 + 200) * 3)
    expect(t.totalCostUsd).toBeCloseTo(0.03)
    expect(t.activeDays).toBe(2)
  })

  it('sessionsPerDay buckets and splits by project', () => {
    const rows = sessionsPerDay(sessions)
    expect(rows).toHaveLength(2)
    const apr10 = rows.find(r => r.date === '2026-04-10')!
    expect(apr10.p1).toBe(1)
    expect(apr10.p2).toBe(1)
  })

  it('tokensPerDay returns input/output/cache split', () => {
    const rows = tokensPerDay(sessions)
    const apr10 = rows.find(r => r.date === '2026-04-10')!
    expect(apr10.input).toBe(200)
    expect(apr10.output).toBe(100)
    expect(apr10.cacheRead).toBe(400)
  })

  it('toolFrequency counts by name sorted desc', () => {
    const rows = toolFrequency(sessions)
    expect(rows[0].name).toBe('Bash')
    expect(rows[0].count).toBe(3)
  })

  it('modelUsageOverTime aggregates per day per model', () => {
    const rows = modelUsageOverTime(sessions)
    const apr10 = rows.find(r => r.date === '2026-04-10')!
    expect(apr10['claude-opus-4-6']).toBe(2)
  })

  it('avgSessionLength returns per-day average', () => {
    const rows = avgSessionLength(sessions)
    expect(rows[0].avgMessages).toBe(10)
  })

  it('costPerDay stacks by project', () => {
    const rows = costPerDay(sessions)
    const apr10 = rows.find(r => r.date === '2026-04-10')!
    expect(apr10.p1).toBeCloseTo(0.01)
    expect(apr10.p2).toBeCloseTo(0.01)
  })

  it('activityHeatmap returns one row per day with count', () => {
    const rows = activityHeatmap(sessions)
    const map = Object.fromEntries(rows.map(r => [r.date, r.count]))
    expect(map['2026-04-10']).toBe(2)
    expect(map['2026-04-11']).toBe(1)
  })
})
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm test -- aggregator
```

- [ ] **Step 3: Implement `lib/sessions/aggregator.ts`**

```ts
import type { SessionMeta } from './types'

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function bucketByDay<T>(
  sessions: SessionMeta[],
  init: () => T,
  reducer: (acc: T, s: SessionMeta) => void,
): Array<T & { date: string }> {
  const map = new Map<string, T>()
  for (const s of sessions) {
    const k = dayKey(s.startedAt)
    if (!map.has(k)) map.set(k, init())
    reducer(map.get(k)!, s)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))
}

export interface KpiTotals {
  sessionCount: number
  totalTokens: number
  totalCostUsd: number
  activeDays: number
}

export function totalsKpi(sessions: SessionMeta[]): KpiTotals {
  const days = new Set<string>()
  let totalTokens = 0
  let totalCostUsd = 0
  for (const s of sessions) {
    days.add(dayKey(s.startedAt))
    totalTokens += s.tokens.input + s.tokens.output + s.tokens.cacheCreate + s.tokens.cacheRead
    if (s.estimatedCostUsd != null) totalCostUsd += s.estimatedCostUsd
  }
  return {
    sessionCount: sessions.length,
    totalTokens,
    totalCostUsd,
    activeDays: days.size,
  }
}

/** Each row is { date, [projectId]: count, ... } for stacked bar. */
export function sessionsPerDay(
  sessions: SessionMeta[],
): Array<Record<string, string | number>> {
  return bucketByDay<Record<string, number>>(
    sessions,
    () => ({}),
    (acc, s) => { acc[s.projectId] = (acc[s.projectId] ?? 0) + 1 },
  )
}

export function tokensPerDay(sessions: SessionMeta[]) {
  return bucketByDay(
    sessions,
    () => ({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }),
    (acc, s) => {
      acc.input += s.tokens.input
      acc.output += s.tokens.output
      acc.cacheCreate += s.tokens.cacheCreate
      acc.cacheRead += s.tokens.cacheRead
    },
  )
}

export function toolFrequency(
  sessions: SessionMeta[],
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const s of sessions)
    for (const t of s.toolCalls)
      counts.set(t.name, (counts.get(t.name) ?? 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export function modelUsageOverTime(
  sessions: SessionMeta[],
): Array<Record<string, string | number>> {
  return bucketByDay<Record<string, number>>(
    sessions,
    () => ({}),
    (acc, s) => { acc[s.model] = (acc[s.model] ?? 0) + 1 },
  )
}

export function avgSessionLength(sessions: SessionMeta[]) {
  return bucketByDay(
    sessions,
    () => ({ totalMessages: 0, count: 0, avgMessages: 0 }),
    (acc, s) => {
      acc.totalMessages += s.messageCount
      acc.count += 1
      acc.avgMessages = acc.totalMessages / acc.count
    },
  )
}

export function costPerDay(
  sessions: SessionMeta[],
): Array<Record<string, string | number>> {
  return bucketByDay<Record<string, number>>(
    sessions,
    () => ({}),
    (acc, s) => {
      if (s.estimatedCostUsd != null)
        acc[s.projectId] = (acc[s.projectId] ?? 0) + s.estimatedCostUsd
    },
  )
}

export function activityHeatmap(
  sessions: SessionMeta[],
): Array<{ date: string; count: number }> {
  const rows = bucketByDay(
    sessions,
    () => ({ count: 0 }),
    (acc) => { acc.count += 1 },
  )
  return rows.map(r => ({ date: r.date, count: r.count }))
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm test -- aggregator
```

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/aggregator.ts test/aggregator.test.ts
git commit -m "feat(sessions): aggregator with metric functions and tests"
```

---

## Task 8: Data-loading server functions

**Files:**
- Create: `lib/sessions/load.ts`

Single entry point that dashboards and detail routes call. Uses `scanner` + `cache` + `parser`.

- [ ] **Step 1: Create `lib/sessions/load.ts`**

```ts
import 'server-only'
import { scanProjectsDir } from './scanner'
import { parseSessionFile } from './parser'
import { sessionCache } from './cache'
import { CLAUDE_PROJECTS_DIR } from './paths'
import type { SessionMeta, Session } from './types'

/** Returns dashboard-mode metadata for every session found. */
export async function loadAllSessionMetas(): Promise<SessionMeta[]> {
  const files = await scanProjectsDir(CLAUDE_PROJECTS_DIR)
  const out: SessionMeta[] = []
  for (const f of files) {
    const cached = sessionCache.get(f.filePath, f.mtimeMs)
    if (cached) { out.push(cached); continue }
    const parsed = await parseSessionFile(f.filePath, { mode: 'meta' })
    if (parsed) {
      sessionCache.set(f.filePath, f.mtimeMs, parsed as SessionMeta)
      out.push(parsed as SessionMeta)
    }
  }
  return out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

/** Full session load for the detail route. Bypasses cache (cache holds meta only). */
export async function loadFullSession(
  projectId: string,
  sessionId: string,
): Promise<Session | null> {
  const files = await scanProjectsDir(CLAUDE_PROJECTS_DIR)
  const match = files.find(f => f.projectId === projectId && f.sessionId === sessionId)
  if (!match) return null
  const parsed = await parseSessionFile(match.filePath, { mode: 'full' })
  return (parsed as Session) ?? null
}

/** Used by the Refresh action to invalidate the meta cache. */
export function clearSessionCache(): void {
  sessionCache.clear()
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sessions/load.ts
git commit -m "feat(sessions): server-only data loading entry points"
```

---

## Task 9: Root layout and ElevenLabs-styled design tokens

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ElevenLabs-inspired dark palette */
    --background: 0 0% 4%;          /* near-black */
    --foreground: 0 0% 98%;
    --card: 0 0% 6%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 7%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 12%;
    --secondary-foreground: 0 0% 90%;
    --muted: 0 0% 10%;
    --muted-foreground: 0 0% 60%;
    --accent: 264 95% 70%;          /* subtle violet accent */
    --accent-foreground: 0 0% 98%;
    --border: 0 0% 14%;
    --input: 0 0% 14%;
    --ring: 264 95% 70%;
    --radius: 0.75rem;

    /* Chart palette — muted, differentiable */
    --chart-1: 264 80% 65%;
    --chart-2: 190 80% 55%;
    --chart-3: 150 60% 55%;
    --chart-4: 30 85% 60%;
    --chart-5: 340 75% 65%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}
```

- [ ] **Step 2: Update `tailwind.config.ts` — ensure the dark HSL tokens are wired**

Append to `theme.extend`:

```ts
colors: {
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  secondary: {
    DEFAULT: 'hsl(var(--secondary))',
    foreground: 'hsl(var(--secondary-foreground))',
  },
  muted: {
    DEFAULT: 'hsl(var(--muted))',
    foreground: 'hsl(var(--muted-foreground))',
  },
  accent: {
    DEFAULT: 'hsl(var(--accent))',
    foreground: 'hsl(var(--accent-foreground))',
  },
  card: {
    DEFAULT: 'hsl(var(--card))',
    foreground: 'hsl(var(--card-foreground))',
  },
  popover: {
    DEFAULT: 'hsl(var(--popover))',
    foreground: 'hsl(var(--popover-foreground))',
  },
  chart: {
    1: 'hsl(var(--chart-1))',
    2: 'hsl(var(--chart-2))',
    3: 'hsl(var(--chart-3))',
    4: 'hsl(var(--chart-4))',
    5: 'hsl(var(--chart-5))',
  },
},
borderRadius: {
  lg: 'var(--radius)',
  md: 'calc(var(--radius) - 2px)',
  sm: 'calc(var(--radius) - 4px)',
},
```

(If shadcn init already wrote these, this step is a no-op confirmation.)

- [ ] **Step 3: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Claude Session Visualizer',
  description: 'Timeline and analytics for your Claude Code sessions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} ${mono.variable} font-sans`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify dev server boots**

```bash
npm run dev
```

Open http://localhost:3000 — page should render (default content) on dark background. Ctrl-C to stop.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css tailwind.config.ts
git commit -m "feat(ui): ElevenLabs dark theme tokens + root layout"
```

---

## Task 10: Dashboard route + client shell + KPI cards

**Files:**
- Create: `app/page.tsx`, `components/dashboard/dashboard-client.tsx`, `components/dashboard/header-bar.tsx`, `components/dashboard/kpi-cards.tsx`
- Create: `app/actions.ts`

- [ ] **Step 1: Create `app/actions.ts` (Refresh server action)**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { clearSessionCache } from '@/lib/sessions/load'

export async function refreshSessions() {
  clearSessionCache()
  revalidatePath('/')
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
import { loadAllSessionMetas } from '@/lib/sessions/load'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const sessions = await loadAllSessionMetas()
  // Server → Client: serialize Dates to strings (Next does this, but be explicit)
  const serialized = sessions.map(s => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt.toISOString(),
    toolCalls: s.toolCalls.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
  }))
  return <DashboardClient sessions={serialized} />
}
```

- [ ] **Step 3: Create `components/dashboard/dashboard-client.tsx`**

```tsx
'use client'
import { useMemo, useState } from 'react'
import type { SessionMeta } from '@/lib/sessions/types'
import { HeaderBar } from './header-bar'
import { KpiCards } from './kpi-cards'

export type SerializedSession = Omit<SessionMeta, 'startedAt' | 'endedAt' | 'toolCalls'> & {
  startedAt: string
  endedAt: string
  toolCalls: Array<{ name: string; timestamp: string; durationMs?: number }>
}

function hydrate(s: SerializedSession): SessionMeta {
  return {
    ...s,
    startedAt: new Date(s.startedAt),
    endedAt: new Date(s.endedAt),
    toolCalls: s.toolCalls.map(t => ({ ...t, timestamp: new Date(t.timestamp) })),
  }
}

export type DateRange = '7d' | '30d' | '90d' | 'all'

export function DashboardClient({ sessions: raw }: { sessions: SerializedSession[] }) {
  const allSessions = useMemo(() => raw.map(hydrate), [raw])
  const [range, setRange] = useState<DateRange>('30d')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of allSessions) map.set(s.projectId, s.projectLabel)
    return [...map.entries()].map(([id, label]) => ({ id, label }))
  }, [allSessions])

  const filtered = useMemo(() => {
    const now = Date.now()
    const cutoff = range === 'all' ? 0
      : now - ({ '7d': 7, '30d': 30, '90d': 90 }[range] * 24 * 60 * 60 * 1000)
    return allSessions.filter(s => {
      if (s.startedAt.getTime() < cutoff) return false
      if (selectedProjects.length && !selectedProjects.includes(s.projectId)) return false
      return true
    })
  }, [allSessions, range, selectedProjects])

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        range={range} onRangeChange={setRange}
        projects={projects}
        selected={selectedProjects} onSelectedChange={setSelectedProjects}
      />
      <main className="mx-auto max-w-[1400px] px-8 py-10 space-y-10">
        <KpiCards sessions={filtered} />
        {/* Charts, swimlane added in later tasks */}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/dashboard/header-bar.tsx`**

```tsx
'use client'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RefreshCw } from 'lucide-react'
import { refreshSessions } from '@/app/actions'
import type { DateRange } from './dashboard-client'

interface Props {
  range: DateRange
  onRangeChange: (r: DateRange) => void
  projects: Array<{ id: string; label: string }>
  selected: string[]
  onSelectedChange: (s: string[]) => void
}

export function HeaderBar({ range, onRangeChange, projects, selected, onSelectedChange }: Props) {
  const toggle = (id: string) =>
    onSelectedChange(selected.includes(id) ? selected.filter(p => p !== id) : [...selected, id])

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1400px] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-accent" />
          <h1 className="text-sm font-medium tracking-tight">Claude Session Visualizer</h1>
        </div>

        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => onRangeChange(v as DateRange)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Projects {selected.length > 0 && `(${selected.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Filter by project</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projects.map(p => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                >
                  {p.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <form action={refreshSessions}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Create `components/dashboard/kpi-cards.tsx`**

```tsx
'use client'
import { Card } from '@/components/ui/card'
import type { SessionMeta } from '@/lib/sessions/types'
import { totalsKpi } from '@/lib/sessions/aggregator'

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toLocaleString()
}

export function KpiCards({ sessions }: { sessions: SessionMeta[] }) {
  const t = totalsKpi(sessions)
  const cards = [
    { label: 'Sessions',    value: t.sessionCount.toLocaleString() },
    { label: 'Total tokens', value: formatNumber(t.totalTokens) },
    { label: 'Est. cost',    value: `$${t.totalCostUsd.toFixed(2)}` },
    { label: 'Active days',  value: t.activeDays.toString() },
  ]
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label} className="p-6 bg-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {c.label}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight font-mono">
            {c.value}
          </div>
        </Card>
      ))}
    </section>
  )
}
```

- [ ] **Step 6: Smoke test**

```bash
npm run dev
```

Open http://localhost:3000. Expected: dark page, header, 4 KPI cards with real numbers from your own `~/.claude/projects`. Refresh button works (submits and revalidates).

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/actions.ts components/dashboard
git commit -m "feat(dashboard): route, client shell, header, KPI cards"
```

---

## Task 11: Main charts — Sessions-per-day & Tokens-per-day

**Files:**
- Create: `components/dashboard/charts/chart-card.tsx`, `components/dashboard/charts/sessions-per-day.tsx`, `components/dashboard/charts/tokens-per-day.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Create `components/dashboard/charts/chart-card.tsx` (shared wrapper)**

```tsx
import { Card } from '@/components/ui/card'

export function ChartCard({
  title, subtitle, children, className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`p-6 bg-card ${className}`}>
      <div className="mb-6">
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="h-[260px] w-full">{children}</div>
    </Card>
  )
}
```

- [ ] **Step 2: Create `components/dashboard/charts/sessions-per-day.tsx`**

```tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { sessionsPerDay } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

const CHART_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
]

export function SessionsPerDay({ sessions }: { sessions: SessionMeta[] }) {
  const data = sessionsPerDay(sessions)
  const projectIds = [...new Set(sessions.map(s => s.projectId))]

  return (
    <ChartCard title="Sessions per day" subtitle="Stacked by project">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, fontSize: 12,
            }}
          />
          {projectIds.map((pid, i) => (
            <Bar key={pid} dataKey={pid} stackId="a"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={i === projectIds.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

- [ ] **Step 3: Create `components/dashboard/charts/tokens-per-day.tsx`**

```tsx
'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { tokensPerDay } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

export function TokensPerDay({ sessions }: { sessions: SessionMeta[] }) {
  const data = tokensPerDay(sessions)
  return (
    <ChartCard title="Tokens per day" subtitle="Input / output / cache">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="cacheRead"   stackId="1" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.4} />
          <Area type="monotone" dataKey="cacheCreate" stackId="1" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.4} />
          <Area type="monotone" dataKey="input"       stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.5} />
          <Area type="monotone" dataKey="output"      stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

- [ ] **Step 4: Mount them in `dashboard-client.tsx`**

Edit the `<main>` block to add, after `<KpiCards ...>`:

```tsx
<section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <SessionsPerDay sessions={filtered} />
  <TokensPerDay sessions={filtered} />
</section>
```

Add imports at the top:

```tsx
import { SessionsPerDay } from './charts/sessions-per-day'
import { TokensPerDay } from './charts/tokens-per-day'
```

- [ ] **Step 5: Smoke test + commit**

```bash
npm run dev
# verify both charts render in /
```

```bash
git add components/dashboard/charts app/page.tsx components/dashboard/dashboard-client.tsx
git commit -m "feat(dashboard): sessions-per-day and tokens-per-day charts"
```

---

## Task 12: Secondary charts — tool frequency, model usage, avg session length

**Files:**
- Create: `components/dashboard/charts/tool-frequency.tsx`, `model-usage.tsx`, `avg-session-length.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Create `tool-frequency.tsx`**

```tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { toolFrequency } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

export function ToolFrequency({ sessions }: { sessions: SessionMeta[] }) {
  const data = toolFrequency(sessions)
  return (
    <ChartCard title="Tool calls" subtitle="Top 10 tools">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis type="category" dataKey="name" width={80}
                 stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

- [ ] **Step 2: Create `model-usage.tsx`**

```tsx
'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { modelUsageOverTime } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

const CHART_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
]

export function ModelUsage({ sessions }: { sessions: SessionMeta[] }) {
  const data = modelUsageOverTime(sessions)
  const models = [...new Set(sessions.map(s => s.model))]

  return (
    <ChartCard title="Model usage" subtitle="Sessions per model over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, fontSize: 12,
            }}
          />
          {models.map((m, i) => (
            <Area key={m} type="monotone" dataKey={m} stackId="1"
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.4}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

- [ ] **Step 3: Create `avg-session-length.tsx`**

```tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { avgSessionLength } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

export function AvgSessionLength({ sessions }: { sessions: SessionMeta[] }) {
  const data = avgSessionLength(sessions)
  return (
    <ChartCard title="Avg session length" subtitle="Messages per session">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="avgMessages"
                stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

- [ ] **Step 4: Mount in dashboard-client**

Add imports and a new section below the previous grid:

```tsx
import { ToolFrequency } from './charts/tool-frequency'
import { ModelUsage } from './charts/model-usage'
import { AvgSessionLength } from './charts/avg-session-length'
```

```tsx
<section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <ToolFrequency sessions={filtered} />
  <ModelUsage sessions={filtered} />
  <AvgSessionLength sessions={filtered} />
</section>
```

- [ ] **Step 5: Smoke test + commit**

```bash
npm run dev  # confirm 3 new charts render
```

```bash
git add components/dashboard
git commit -m "feat(dashboard): tool frequency, model usage, avg session length charts"
```

---

## Task 13: Cost per day and activity heatmap

**Files:**
- Create: `components/dashboard/charts/cost-per-day.tsx`, `components/dashboard/charts/activity-heatmap.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Create `cost-per-day.tsx`**

```tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { costPerDay } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import { ChartCard } from './chart-card'

const CHART_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
]

export function CostPerDay({ sessions }: { sessions: SessionMeta[] }) {
  const data = costPerDay(sessions)
  const projectIds = [...new Set(sessions.map(s => s.projectId))]
  return (
    <ChartCard title="Cost per day" subtitle="USD, stacked by project">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                 tickFormatter={(v) => `$${v.toFixed(2)}`} />
          <Tooltip
            formatter={(v: number) => `$${v.toFixed(2)}`}
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8, fontSize: 12,
            }}
          />
          {projectIds.map((pid, i) => (
            <Bar key={pid} dataKey={pid} stackId="c"
                 fill={CHART_COLORS[i % CHART_COLORS.length]}
                 radius={i === projectIds.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
```

- [ ] **Step 2: Create `activity-heatmap.tsx`**

A GitHub-style calendar grid. We draw the last 53 weeks × 7 days.

```tsx
'use client'
import { Card } from '@/components/ui/card'
import { activityHeatmap } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'

function buildGrid(counts: Map<string, number>) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Start 52 weeks back, aligned to Sunday
  const start = new Date(today)
  start.setDate(start.getDate() - 52 * 7 - today.getDay())

  const weeks: Array<Array<{ date: string; count: number }>> = []
  const cur = new Date(start)
  while (cur <= today) {
    const week: Array<{ date: string; count: number }> = []
    for (let d = 0; d < 7; d++) {
      const key = cur.toISOString().slice(0, 10)
      week.push({ date: key, count: counts.get(key) ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function intensity(count: number, max: number): string {
  if (count === 0) return 'bg-muted'
  const ratio = count / max
  if (ratio > 0.75) return 'bg-accent'
  if (ratio > 0.5)  return 'bg-accent/75'
  if (ratio > 0.25) return 'bg-accent/50'
  return 'bg-accent/25'
}

export function ActivityHeatmap({ sessions }: { sessions: SessionMeta[] }) {
  const rows = activityHeatmap(sessions)
  const counts = new Map(rows.map(r => [r.date, r.count]))
  const grid = buildGrid(counts)
  const max = Math.max(1, ...rows.map(r => r.count))

  return (
    <Card className="p-6 bg-card">
      <div className="mb-6">
        <h3 className="text-sm font-medium">Activity</h3>
        <p className="text-xs text-muted-foreground mt-1">Sessions over the last year</p>
      </div>
      <TooltipProvider delayDuration={50}>
        <div className="flex gap-[3px] overflow-x-auto">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div className={`h-[11px] w-[11px] rounded-sm ${intensity(day.count, max)}`} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {day.count} session{day.count === 1 ? '' : 's'} · {day.date}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </Card>
  )
}
```

- [ ] **Step 3: Mount in dashboard-client**

```tsx
import { CostPerDay } from './charts/cost-per-day'
import { ActivityHeatmap } from './charts/activity-heatmap'
```

```tsx
<section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <div className="lg:col-span-1"><CostPerDay sessions={filtered} /></div>
  <div className="lg:col-span-2"><ActivityHeatmap sessions={filtered} /></div>
</section>
```

- [ ] **Step 4: Smoke test + commit**

```bash
npm run dev
```

```bash
git add components/dashboard
git commit -m "feat(dashboard): cost-per-day and activity heatmap"
```

---

## Task 14: Cross-project swimlane timeline

**Files:**
- Create: `components/dashboard/swimlane-timeline.tsx`
- Modify: `components/dashboard/dashboard-client.tsx`

A horizontal swimlane with one lane per project. Session blocks positioned by start time; width = duration (min 6px for visibility). Click routes to detail.

- [ ] **Step 1: Create `components/dashboard/swimlane-timeline.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SessionMeta } from '@/lib/sessions/types'

const MODEL_COLOR: Record<string, string> = {
  'claude-opus-4-6':    'bg-chart-1',
  'claude-opus-4-5':    'bg-chart-1',
  'claude-sonnet-4-6':  'bg-chart-2',
  'claude-sonnet-4-5':  'bg-chart-2',
  'claude-haiku-4-5':   'bg-chart-3',
}

function colorFor(model: string): string {
  const key = model.replace(/-\d{8}$/, '')
  return MODEL_COLOR[key] ?? 'bg-chart-4'
}

export function SwimlaneTimeline({ sessions }: { sessions: SessionMeta[] }) {
  if (sessions.length === 0) {
    return (
      <Card className="p-10 bg-card text-center text-sm text-muted-foreground">
        No sessions in the selected range.
      </Card>
    )
  }

  const min = Math.min(...sessions.map(s => s.startedAt.getTime()))
  const max = Math.max(...sessions.map(s => s.endedAt.getTime()))
  const span = Math.max(1, max - min)

  const lanes = new Map<string, SessionMeta[]>()
  for (const s of sessions) {
    if (!lanes.has(s.projectId)) lanes.set(s.projectId, [])
    lanes.get(s.projectId)!.push(s)
  }
  const laneEntries = [...lanes.entries()]

  return (
    <Card className="p-6 bg-card">
      <div className="mb-6">
        <h3 className="text-sm font-medium">Session timeline</h3>
        <p className="text-xs text-muted-foreground mt-1">
          One lane per project. Click a block to open the session.
        </p>
      </div>
      <TooltipProvider delayDuration={50}>
        <div className="space-y-3">
          {laneEntries.map(([projectId, lane]) => (
            <div key={projectId} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-xs text-muted-foreground font-mono">
                {lane[0].projectLabel}
              </div>
              <div className="relative flex-1 h-6 rounded bg-muted/40">
                {lane.map(s => {
                  const left = ((s.startedAt.getTime() - min) / span) * 100
                  const width = Math.max(0.4, (s.durationMs / span) * 100)
                  return (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/session/${s.projectId}/${s.id}`}
                          className={`absolute top-0 h-full rounded ${colorFor(s.model)} hover:ring-2 hover:ring-accent transition`}
                          style={{ left: `${left}%`, width: `${width}%`, minWidth: 4 }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <div className="font-medium">{s.model}</div>
                        <div className="text-muted-foreground">
                          {s.startedAt.toLocaleString()}
                        </div>
                        <div className="text-muted-foreground">
                          {s.messageCount} msgs · {Math.round(s.durationMs / 1000)}s
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>
    </Card>
  )
}
```

- [ ] **Step 2: Mount in dashboard-client — add the final section**

```tsx
import { SwimlaneTimeline } from './swimlane-timeline'
```

```tsx
<section>
  <SwimlaneTimeline sessions={filtered} />
</section>
```

- [ ] **Step 3: Smoke test + commit**

```bash
npm run dev  # clicking a block should navigate to /session/.../... (404 until Task 15)
```

```bash
git add components/dashboard
git commit -m "feat(dashboard): cross-project swimlane timeline"
```

---

## Task 15: Session detail route + top bar

**Files:**
- Create: `app/session/[projectId]/[sessionId]/page.tsx`, `components/session/top-bar.tsx`, `components/session/session-view.tsx`

- [ ] **Step 1: Create `app/session/[projectId]/[sessionId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { loadFullSession } from '@/lib/sessions/load'
import { SessionView } from '@/components/session/session-view'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>
}) {
  const { projectId, sessionId } = await params
  const session = await loadFullSession(
    decodeURIComponent(projectId),
    decodeURIComponent(sessionId),
  )
  if (!session) notFound()

  const serialized = {
    ...session,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt.toISOString(),
    toolCalls: session.toolCalls.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
    messages: session.messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
  }
  return <SessionView session={serialized} />
}
```

- [ ] **Step 2: Create `components/session/top-bar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import type { SessionMeta } from '@/lib/sessions/types'

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function formatTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toString()
}

export function SessionTopBar({ session }: { session: SessionMeta }) {
  const totalTokens =
    session.tokens.input + session.tokens.output +
    session.tokens.cacheCreate + session.tokens.cacheRead

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1600px] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Dashboard</Link>
          </Button>
          <div className="text-xs text-muted-foreground font-mono">
            {session.projectLabel} / {session.id.slice(0, 8)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">{session.model}</Badge>
          <span className="text-muted-foreground">{formatDuration(session.durationMs)}</span>
          <span className="text-muted-foreground">· {formatTokens(totalTokens)} tok</span>
          {session.estimatedCostUsd != null && (
            <span className="text-muted-foreground">
              · ${session.estimatedCostUsd.toFixed(3)}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create `components/session/session-view.tsx` (shell; scrubber and transcript in next tasks)**

```tsx
'use client'
import { useMemo, useState } from 'react'
import type { Session, Message } from '@/lib/sessions/types'
import { SessionTopBar } from './top-bar'

type Serialized<T> = Omit<T, 'startedAt' | 'endedAt' | 'toolCalls' | 'messages' | 'timestamp'> & {
  startedAt: string
  endedAt: string
  toolCalls: Array<{ name: string; timestamp: string; durationMs?: number }>
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>
}

function hydrate(s: Serialized<Session>): Session {
  return {
    ...s,
    startedAt: new Date(s.startedAt),
    endedAt: new Date(s.endedAt),
    toolCalls: s.toolCalls.map(t => ({ ...t, timestamp: new Date(t.timestamp) })),
    messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
  }
}

export function SessionView({ session: raw }: { session: Serialized<Session> }) {
  const session = useMemo(() => hydrate(raw), [raw])
  const [activeId, setActiveId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background">
      <SessionTopBar session={session} />
      <main className="mx-auto max-w-[1600px] px-8 py-6 grid grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          {/* TimelineScrubber goes here (Task 16) */}
          {/* TranscriptPanel goes here (Task 17) */}
          <div className="text-xs text-muted-foreground">
            {session.messages.length} messages · placeholder
          </div>
        </div>
        <aside className="border-l border-border pl-6">
          {/* SessionSidebar (Task 17) */}
        </aside>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Smoke test + commit**

```bash
npm run dev
# Click any session block on / — should land on detail page with header.
```

```bash
git add app/session components/session
git commit -m "feat(session): detail route, top bar, view shell"
```

---

## Task 16: Timeline scrubber

**Files:**
- Create: `components/session/timeline-scrubber.tsx`
- Modify: `components/session/session-view.tsx`

Segment-per-message, colored by role/tool, positioned by timestamp, width proportional to the gap to the next message (minimum 4px).

- [ ] **Step 1: Create `components/session/timeline-scrubber.tsx`**

```tsx
'use client'
import { Card } from '@/components/ui/card'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Message, Session } from '@/lib/sessions/types'

function colorFor(m: Message): string {
  if (m.role === 'user') return 'bg-chart-2'
  if (m.role === 'tool_result') return 'bg-chart-3'
  if (m.isThinking) return 'bg-muted-foreground/40'
  if (m.toolName) return 'bg-chart-4'
  return 'bg-chart-1' // assistant text
}

function snippet(m: Message): string {
  const s = (m.content ?? '').replace(/\s+/g, ' ').trim()
  return s.length > 120 ? s.slice(0, 117) + '…' : s
}

interface Props {
  session: Session
  onSelect: (uuid: string) => void
  activeId: string | null
}

export function TimelineScrubber({ session, onSelect, activeId }: Props) {
  const start = session.startedAt.getTime()
  const end   = session.endedAt.getTime()
  const span  = Math.max(1, end - start)

  const msgs = session.messages

  return (
    <Card className="p-4 bg-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Timeline</h3>
        <div className="text-xs text-muted-foreground font-mono">
          {msgs.length} events
        </div>
      </div>
      <TooltipProvider delayDuration={50}>
        <div className="relative h-10 w-full rounded bg-muted/40 overflow-hidden">
          {msgs.map((m, i) => {
            const t = m.timestamp.getTime()
            const next = i < msgs.length - 1 ? msgs[i + 1].timestamp.getTime() : end
            const left  = ((t - start) / span) * 100
            const width = Math.max(0.2, ((next - t) / span) * 100)
            const isActive = m.uuid === activeId
            return (
              <Tooltip key={m.uuid}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(m.uuid)}
                    className={`absolute top-0 h-full ${colorFor(m)} ${isActive ? 'ring-2 ring-accent' : ''} hover:brightness-125`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: 2 }}
                    aria-label={`${m.role} at ${m.timestamp.toISOString()}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs">
                  <div className="font-medium">
                    {m.toolName ? `${m.toolName} (${m.role})` : m.role}
                  </div>
                  <div className="text-muted-foreground">
                    {m.timestamp.toLocaleTimeString()}
                  </div>
                  {snippet(m) && (
                    <div className="mt-1 text-foreground">{snippet(m)}</div>
                  )}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      {/* Tool density mini-map */}
      <div className="mt-2 h-1.5 w-full rounded bg-muted/30 relative">
        {msgs.filter(m => m.toolName).map((m) => {
          const left = ((m.timestamp.getTime() - start) / span) * 100
          return (
            <div key={`mm-${m.uuid}`}
              className="absolute top-0 h-full w-[2px] bg-chart-4"
              style={{ left: `${left}%` }}
            />
          )
        })}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into `session-view.tsx`**

Replace the placeholder inside the left column with:

```tsx
<TimelineScrubber
  session={session}
  activeId={activeId}
  onSelect={(id) => {
    setActiveId(id)
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }}
/>
```

Add import:

```tsx
import { TimelineScrubber } from './timeline-scrubber'
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
# Open a session. Hover segments → tooltip appears. Click → nothing yet, transcript in next task.
```

- [ ] **Step 4: Commit**

```bash
git add components/session
git commit -m "feat(session): timeline scrubber with tool density minimap"
```

---

## Task 17: Transcript panel + sidebar stats

**Files:**
- Create: `components/session/transcript-panel.tsx`, `components/session/transcript-message.tsx`, `components/session/session-sidebar.tsx`
- Modify: `components/session/session-view.tsx`

- [ ] **Step 1: Create `components/session/transcript-message.tsx`**

```tsx
'use client'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronRight, User, Bot, Wrench, Brain } from 'lucide-react'
import type { Message } from '@/lib/sessions/types'
import { useState } from 'react'

function Icon({ m }: { m: Message }) {
  if (m.role === 'user') return <User className="h-3.5 w-3.5" />
  if (m.role === 'tool_result') return <Wrench className="h-3.5 w-3.5" />
  if (m.isThinking) return <Brain className="h-3.5 w-3.5" />
  if (m.toolName) return <Wrench className="h-3.5 w-3.5" />
  return <Bot className="h-3.5 w-3.5" />
}

function labelFor(m: Message): string {
  if (m.role === 'user') return 'User'
  if (m.role === 'tool_result') return `Tool result`
  if (m.isThinking) return 'Thinking'
  if (m.toolName) return `Tool: ${m.toolName}`
  return 'Assistant'
}

export function TranscriptMessage({
  message, isActive,
}: { message: Message; isActive: boolean }) {
  const [open, setOpen] = useState(false)
  const isCollapsible = Boolean(message.toolName) || message.role === 'tool_result' || message.isThinking

  return (
    <div
      id={`msg-${message.uuid}`}
      className={`rounded-lg border ${isActive ? 'border-accent bg-accent/5' : 'border-border bg-card'} p-4 transition`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon m={message} />
        <span className="font-medium text-foreground">{labelFor(message)}</span>
        <span className="font-mono">{message.timestamp.toLocaleTimeString()}</span>
      </div>

      {isCollapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className={`h-3 w-3 transition ${open ? 'rotate-90' : ''}`} />
            {open ? 'Hide content' : 'Show content'}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/40 p-3 rounded">
              {message.content || '(empty)'}
            </pre>
            {message.toolInput !== undefined && (
              <pre className="mt-2 text-xs font-mono whitespace-pre-wrap break-words bg-muted/40 p-3 rounded">
                {JSON.stringify(message.toolInput, null, 2)}
              </pre>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content || <span className="text-muted-foreground italic">(empty)</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/session/transcript-panel.tsx`**

```tsx
'use client'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Message } from '@/lib/sessions/types'
import { TranscriptMessage } from './transcript-message'

interface Props {
  messages: Message[]
  activeId: string | null
}

export function TranscriptPanel({ messages, activeId }: Props) {
  return (
    <ScrollArea className="h-[calc(100vh-260px)] rounded-lg border border-border">
      <div className="p-4 space-y-3">
        {messages.map(m => (
          <TranscriptMessage key={m.uuid} message={m} isActive={m.uuid === activeId} />
        ))}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 3: Create `components/session/session-sidebar.tsx`**

```tsx
'use client'
import { Card } from '@/components/ui/card'
import type { Session } from '@/lib/sessions/types'

function formatN(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toString()
}

export function SessionSidebar({ session }: { session: Session }) {
  const toolCounts = new Map<string, number>()
  for (const t of session.toolCalls)
    toolCounts.set(t.name, (toolCounts.get(t.name) ?? 0) + 1)
  const tools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1])

  const rows = [
    { label: 'Input',        value: formatN(session.tokens.input) },
    { label: 'Output',       value: formatN(session.tokens.output) },
    { label: 'Cache create', value: formatN(session.tokens.cacheCreate) },
    { label: 'Cache read',   value: formatN(session.tokens.cacheRead) },
  ]

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Tokens</h4>
        <dl className="space-y-1.5">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between text-xs">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="font-mono">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-4 bg-card">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Tool calls</h4>
        {tools.length === 0 ? (
          <div className="text-xs text-muted-foreground">None</div>
        ) : (
          <dl className="space-y-1.5">
            {tools.map(([name, count]) => (
              <div key={name} className="flex justify-between text-xs">
                <dt className="font-mono">{name}</dt>
                <dd className="font-mono">{count}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card className="p-4 bg-card">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Turns</h4>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">User</span>
          <span className="font-mono">{session.userTurns}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-muted-foreground">Assistant</span>
          <span className="font-mono">{session.assistantTurns}</span>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Wire into `session-view.tsx`**

Replace the placeholder block and the empty aside with:

```tsx
<TranscriptPanel messages={session.messages} activeId={activeId} />
```

```tsx
<aside className="border-l border-border pl-6">
  <SessionSidebar session={session} />
</aside>
```

Add imports:

```tsx
import { TranscriptPanel } from './transcript-panel'
import { SessionSidebar } from './session-sidebar'
```

- [ ] **Step 5: Smoke test**

```bash
npm run dev
# Open a session. Scrubber segments → click → transcript scrolls + highlights. Sidebar shows token breakdown + tool counts. Tool messages are collapsed by default.
```

- [ ] **Step 6: Commit**

```bash
git add components/session
git commit -m "feat(session): transcript panel with collapsible tool messages + sidebar stats"
```

---

## Task 18: Error/empty states, README, and final smoke test

**Files:**
- Create: `app/error.tsx`, `app/not-found.tsx`, `components/dashboard/empty-state.tsx`, `README.md`
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Create `app/error.tsx`**

```tsx
'use client'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-medium">Something went wrong</h2>
        <p className="text-sm text-muted-foreground font-mono">{error.message}</p>
        <button
          onClick={reset}
          className="text-sm px-4 py-2 rounded bg-accent text-accent-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/not-found.tsx`**

```tsx
import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-medium">Session not found</h2>
        <p className="text-sm text-muted-foreground">
          The session file no longer exists in ~/.claude/projects.
        </p>
        <Link href="/" className="text-sm underline">Back to dashboard</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/dashboard/empty-state.tsx`**

```tsx
import { Card } from '@/components/ui/card'
import { CLAUDE_PROJECTS_DIR } from '@/lib/sessions/paths'

export function EmptyState() {
  return (
    <Card className="p-10 text-center space-y-3 bg-card">
      <h3 className="text-base font-medium">No Claude sessions found</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        This app reads session transcripts from{' '}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{CLAUDE_PROJECTS_DIR}</code>.
        Start a Claude Code session and refresh this page.
      </p>
    </Card>
  )
}
```

Note: `CLAUDE_PROJECTS_DIR` is a server-only value. Since this is server-rendered at first load via the dashboard route, move the display string into a prop instead to avoid importing `node:os` into a client component. Replace with:

```tsx
import { Card } from '@/components/ui/card'

export function EmptyState({ projectsDir }: { projectsDir: string }) {
  return (
    <Card className="p-10 text-center space-y-3 bg-card">
      <h3 className="text-base font-medium">No Claude sessions found</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        This app reads session transcripts from{' '}
        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{projectsDir}</code>.
        Start a Claude Code session and refresh this page.
      </p>
    </Card>
  )
}
```

- [ ] **Step 4: Pass the path through from `app/page.tsx`**

```tsx
import { loadAllSessionMetas } from '@/lib/sessions/load'
import { CLAUDE_PROJECTS_DIR } from '@/lib/sessions/paths'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const sessions = await loadAllSessionMetas()
  const serialized = sessions.map(s => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt.toISOString(),
    toolCalls: s.toolCalls.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
  }))
  return <DashboardClient sessions={serialized} projectsDir={CLAUDE_PROJECTS_DIR} />
}
```

Then in `dashboard-client.tsx` accept `projectsDir: string` as a prop, and render `<EmptyState projectsDir={projectsDir} />` when `allSessions.length === 0`:

```tsx
if (allSessions.length === 0) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[1400px] px-8 py-20">
        <EmptyState projectsDir={projectsDir} />
      </main>
    </div>
  )
}
```

Add import `import { EmptyState } from './empty-state'`.

- [ ] **Step 5: Create `README.md`**

```markdown
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

Next.js 15 · TypeScript · Tailwind · shadcn/ui (Radix) · Recharts · Vitest.

## Pricing

Edit `lib/sessions/pricing.ts` to update per-model token rates.
```

- [ ] **Step 6: Run full test suite and production build**

```bash
npm test
npm run build
```

Expected: all tests pass, build succeeds without errors or type issues.

- [ ] **Step 7: Manual smoke test checklist**

Run `npm run dev` and verify:

- [ ] `/` renders with KPI cards, all 6 charts, activity heatmap, swimlane
- [ ] Date range select changes all charts
- [ ] Project multi-select filters all charts
- [ ] Refresh button re-scans (add a new session file to see it)
- [ ] Clicking a swimlane block opens `/session/.../...`
- [ ] Session detail shows top bar with model + duration + cost
- [ ] Timeline scrubber renders segments and tool density mini-map
- [ ] Hovering a segment shows tooltip with role, time, snippet
- [ ] Clicking a segment scrolls the transcript and highlights the message
- [ ] Transcript tool messages are collapsed by default and expand cleanly
- [ ] Sidebar shows token breakdown + tool counts
- [ ] Navigating to a bogus session URL shows not-found page
- [ ] If `~/.claude/projects` is empty, dashboard shows the empty state

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: error/empty states, README, final polish"
```

- [ ] **Step 9: Push to remote**

```bash
git push origin main
```

---

## Self-Review Notes

- **Spec coverage:** All 8 dashboard metrics (Tasks 10-13), two-tier loading (Tasks 4, 8), cross-project swimlane (Task 14), timeline scrubber + transcript split view (Tasks 16-17), error/empty states (Task 18), Vitest tests for parser/scanner/cache/aggregator/pricing (Tasks 3-7). Aesthetic tokens in Task 9. ✔
- **Placeholders:** None — every code step contains the actual code.
- **Type consistency:** `SessionMeta` / `Session` / `Message` used consistently. `estimateCostUsd` signature matches across pricing.ts and parser.ts. `scanProjectsDir` returns `ScannedFile[]` used by `loadAllSessionMetas`. Chart color tokens `--chart-1..5` defined in Task 9, referenced in Tasks 11-14, 16.
- **Scope:** Single focused plan. No live file-watching, no SQLite, no Tauri — all explicitly deferred per spec.
