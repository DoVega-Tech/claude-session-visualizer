'use client'
import { useState } from 'react'
import { ChevronRight, User, Bot, Wrench, Brain } from 'lucide-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import type { Message } from '@/lib/sessions/types'

function roleIcon(m: Message) {
  if (m.isThinking) return <Brain className="size-3.5 shrink-0 text-muted-foreground/70" />
  if (m.toolName || m.role === 'tool_result') return <Wrench className="size-3.5 shrink-0 text-[hsl(30_85%_60%)]" />
  if (m.role === 'user') return <User className="size-3.5 shrink-0 text-[hsl(190_80%_55%)]" />
  return <Bot className="size-3.5 shrink-0 text-[hsl(264_80%_65%)]" />
}

function roleLabel(m: Message): string {
  if (m.isThinking) return 'Thinking'
  if (m.toolName && m.role !== 'tool_result') return `Tool: ${m.toolName}`
  if (m.role === 'tool_result') return `Result: ${m.toolName ?? 'tool'}`
  if (m.role === 'user') return 'User'
  if (m.role === 'assistant') return 'Assistant'
  return m.role
}

function isCollapsible(m: Message): boolean {
  return !!(m.isThinking || m.toolName || m.role === 'tool_result')
}

interface Props {
  message: Message
  isActive: boolean
}

export function TranscriptMessage({ message: m, isActive }: Props) {
  const [open, setOpen] = useState(false)
  const collapsible = isCollapsible(m)

  const header = (
    <div className="flex items-center gap-2 min-w-0">
      {roleIcon(m)}
      <span className="text-xs font-medium truncate">{roleLabel(m)}</span>
      <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
        {m.timestamp.toLocaleTimeString()}
      </span>
    </div>
  )

  const bodyContent = (() => {
    if (m.toolName && m.role !== 'tool_result' && m.toolInput != null) {
      return (
        <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(m.toolInput, null, 2)}
        </pre>
      )
    }
    if (m.role === 'tool_result' && m.toolOutput != null) {
      return (
        <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {typeof m.toolOutput === 'string'
            ? m.toolOutput
            : JSON.stringify(m.toolOutput, null, 2)}
        </pre>
      )
    }
    return (
      <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
        {m.content}
      </p>
    )
  })()

  return (
    <div
      id={`msg-${m.uuid}`}
      className={`rounded-lg border px-3 py-2 transition-colors ${
        isActive ? 'border-accent bg-accent/10' : 'border-border bg-card'
      }`}
    >
      {collapsible ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full text-left">
            <div className="flex items-center gap-1">
              <ChevronRight
                className={`size-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
              />
              <div className="flex-1 min-w-0">{header}</div>
            </div>
            {!open && (
              <span className="mt-1 block text-[10px] text-muted-foreground ml-4">
                Show content
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 ml-4">{bodyContent}</div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          {header}
          <div className="mt-2">{bodyContent}</div>
        </>
      )}
    </div>
  )
}
