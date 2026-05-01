'use client'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import type { SessionMeta } from '@/lib/sessions/types'

const MODEL_COLOR: Record<string, string> = {
  'claude-opus-4-6':    'bg-[hsl(264_80%_65%)]',
  'claude-opus-4-5':    'bg-[hsl(264_80%_65%)]',
  'claude-sonnet-4-6':  'bg-[hsl(190_80%_55%)]',
  'claude-sonnet-4-5':  'bg-[hsl(190_80%_55%)]',
  'claude-haiku-4-5':   'bg-[hsl(150_60%_55%)]',
}

function colorFor(model: string): string {
  const key = model.replace(/-\d{8}$/, '')
  return MODEL_COLOR[key] ?? 'bg-[hsl(30_85%_60%)]'
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
                  <Link
                    key={s.id}
                    href={`/session/${encodeURIComponent(s.projectId)}/${encodeURIComponent(s.id)}`}
                    title={`${s.model} · ${s.startedAt.toLocaleString()} · ${s.messageCount} msgs · ${Math.round(s.durationMs / 1000)}s`}
                    className={`absolute top-0 h-full rounded ${colorFor(s.model)} hover:ring-2 hover:ring-accent transition-shadow`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: 4 }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
