'use client'
import { useMemo, useState } from 'react'
import type { Session, Message } from '@/lib/sessions/types'
import { SessionTopBar } from './top-bar'
import { TimelineScrubber } from './timeline-scrubber'
import { TranscriptPanel } from './transcript-panel'
import { SessionSidebar } from './session-sidebar'

type SerializedMessage = Omit<Message, 'timestamp'> & { timestamp: string }
type SerializedSession = Omit<Session, 'startedAt' | 'endedAt' | 'toolCalls' | 'messages'> & {
  startedAt: string
  endedAt: string
  toolCalls: Array<{ name: string; timestamp: string; durationMs?: number }>
  messages: SerializedMessage[]
}

function hydrate(s: SerializedSession): Session {
  return {
    ...s,
    startedAt: new Date(s.startedAt),
    endedAt: new Date(s.endedAt),
    toolCalls: s.toolCalls.map(t => ({ ...t, timestamp: new Date(t.timestamp) })),
    messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
  }
}

export function SessionView({ session: raw }: { session: SerializedSession }) {
  const session = useMemo(() => hydrate(raw), [raw])
  const [activeId, setActiveId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background">
      <SessionTopBar session={session} />
      <main className="mx-auto max-w-[1600px] px-8 py-6 grid grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          <TimelineScrubber
            session={session}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id)
              document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
          />
          <TranscriptPanel messages={session.messages} activeId={activeId} />
        </div>
        <aside className="border-l border-border pl-6">
          <SessionSidebar session={session} />
        </aside>
      </main>
    </div>
  )
}
