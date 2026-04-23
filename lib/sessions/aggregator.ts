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
  return { sessionCount: sessions.length, totalTokens, totalCostUsd, activeDays: days.size }
}

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
