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
    const s = await parseSessionFile(fx('normal.jsonl'), { mode: 'full' }) as any
    expect(s).not.toBeNull()
    expect('messages' in s).toBe(true)
    expect(s.messages).toHaveLength(4)
  })
})
