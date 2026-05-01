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
