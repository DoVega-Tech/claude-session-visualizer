'use client'
import { Card } from '@/components/ui/card'
import { activityHeatmap } from '@/lib/sessions/aggregator'
import type { SessionMeta } from '@/lib/sessions/types'

function buildGrid(counts: Map<string, number>) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
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
      <div className="flex gap-[3px] overflow-x-auto">
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.count} session${day.count === 1 ? '' : 's'} · ${day.date}`}
                className={`h-[11px] w-[11px] rounded-sm ${intensity(day.count, max)} cursor-default`}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}
