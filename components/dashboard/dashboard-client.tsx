'use client'
import { useMemo, useState } from 'react'
import type { SessionMeta } from '@/lib/sessions/types'
import { HeaderBar } from './header-bar'
import { KpiCards } from './kpi-cards'
import { SessionsPerDay } from './charts/sessions-per-day'
import { TokensPerDay } from './charts/tokens-per-day'
import { ToolFrequency } from './charts/tool-frequency'
import { ModelUsage } from './charts/model-usage'
import { AvgSessionLength } from './charts/avg-session-length'
import { CostPerDay } from './charts/cost-per-day'
import { ActivityHeatmap } from './charts/activity-heatmap'
import { SwimlaneTimeline } from './swimlane-timeline'

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

export function DashboardClient({ sessions: raw, projectsDir }: { sessions: SerializedSession[]; projectsDir: string }) {
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

  if (allSessions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-[1400px] px-8 py-20 text-center">
          <div className="rounded-xl border border-border bg-card p-10 space-y-3">
            <h3 className="text-base font-medium">No Claude sessions found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This app reads session transcripts from{' '}
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{projectsDir}</code>.
              Start a Claude Code session and refresh this page.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar
        range={range} onRangeChange={setRange}
        projects={projects}
        selected={selectedProjects} onSelectedChange={setSelectedProjects}
      />
      <main className="mx-auto max-w-[1400px] px-8 py-10 space-y-10">
        <KpiCards sessions={filtered} />
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SessionsPerDay sessions={filtered} />
          <TokensPerDay sessions={filtered} />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ToolFrequency sessions={filtered} />
          <ModelUsage sessions={filtered} />
          <AvgSessionLength sessions={filtered} />
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1"><CostPerDay sessions={filtered} /></div>
          <div className="lg:col-span-2"><ActivityHeatmap sessions={filtered} /></div>
        </section>
        <section>
          <SwimlaneTimeline sessions={filtered} />
        </section>
      </main>
    </div>
  )
}
