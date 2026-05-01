'use client'
import { Card } from '@/components/ui/card'
import type { Message, Session } from '@/lib/sessions/types'

function colorFor(m: Message): string {
  if (m.role === 'user') return 'bg-[hsl(190_80%_55%)]'
  if (m.role === 'tool_result') return 'bg-[hsl(150_60%_55%)]'
  if (m.isThinking) return 'bg-muted-foreground/40'
  if (m.toolName) return 'bg-[hsl(30_85%_60%)]'
  return 'bg-[hsl(264_80%_65%)]'
}

function snippet(m: Message): string {
  const s = (m.content ?? '').replace(/\s+/g, ' ').trim()
  return s.length > 120 ? s.slice(0, 117) + '…' : s
}

interface Props {
  session: Session
  onSelect: (uuid: string) => void
  activeId: string | null
}

export function TimelineScrubber({ session, onSelect, activeId }: Props) {
  const start = session.startedAt.getTime()
  const end   = session.endedAt.getTime()
  const span  = Math.max(1, end - start)

  const msgs = session.messages

  return (
    <Card className="p-4 bg-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Timeline</h3>
        <div className="text-xs text-muted-foreground font-mono">
          {msgs.length} events
        </div>
      </div>
      <div className="relative h-10 w-full rounded bg-muted/40 overflow-hidden">
        {msgs.map((m, i) => {
          const t = m.timestamp.getTime()
          const next = i < msgs.length - 1 ? msgs[i + 1].timestamp.getTime() : end
          const left  = ((t - start) / span) * 100
          const width = Math.max(0.2, ((next - t) / span) * 100)
          const isActive = m.uuid === activeId
          return (
            <button
              key={m.uuid}
              type="button"
              onClick={() => onSelect(m.uuid)}
              title={`${m.toolName ? `${m.toolName} (${m.role})` : m.role} · ${m.timestamp.toLocaleTimeString()}\n${snippet(m)}`}
              className={`absolute top-0 h-full ${colorFor(m)} ${isActive ? 'ring-2 ring-accent' : ''} hover:brightness-125 transition`}
              style={{ left: `${left}%`, width: `${width}%`, minWidth: 2 }}
              aria-label={`${m.role} at ${m.timestamp.toISOString()}`}
            />
          )
        })}
      </div>

      {/* Tool density mini-map */}
      <div className="mt-2 h-1.5 w-full rounded bg-muted/30 relative">
        {msgs.filter(m => m.toolName).map((m) => {
          const left = ((m.timestamp.getTime() - start) / span) * 100
          return (
            <div key={`mm-${m.uuid}`}
              className="absolute top-0 h-full w-[2px] bg-[hsl(30_85%_60%)]"
              style={{ left: `${left}%` }}
            />
          )
        })}
      </div>
    </Card>
  )
}
