'use client'
import type { Message } from '@/lib/sessions/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TranscriptMessage } from './transcript-message'

interface Props {
  messages: Message[]
  activeId: string | null
}

export function TranscriptPanel({ messages, activeId }: Props) {
  return (
    <ScrollArea className="h-[calc(100vh-260px)] rounded-lg border border-border">
      <div className="p-4 space-y-2">
        {messages.map((m) => (
          <TranscriptMessage
            key={m.uuid}
            message={m}
            isActive={m.uuid === activeId}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
