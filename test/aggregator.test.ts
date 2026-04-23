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
    expect(rows[0].count).toBe(2)
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
