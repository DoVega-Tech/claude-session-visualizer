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
