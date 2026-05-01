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
