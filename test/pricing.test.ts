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
