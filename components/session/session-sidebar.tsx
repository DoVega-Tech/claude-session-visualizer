'use client'
import { Card } from '@/components/ui/card'
import type { Session } from '@/lib/sessions/types'

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

interface Props {
  session: Session
}

export function SessionSidebar({ session }: Props) {
  const { tokens, toolCalls, userTurns, assistantTurns } = session

  // Aggregate tool call counts
  const toolCountMap = new Map<string, number>()
  for (const tc of toolCalls) {
    toolCountMap.set(tc.name, (toolCountMap.get(tc.name) ?? 0) + 1)
  }
  const sortedTools = [...toolCountMap.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      {/* Tokens */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Tokens
        </h3>
        <dl className="space-y-1.5">
          {[
            { label: 'Input', value: tokens.input },
            { label: 'Output', value: tokens.output },
            { label: 'Cache Write', value: tokens.cacheCreate },
            { label: 'Cache Read', value: tokens.cacheRead },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xs font-mono font-medium">{fmtTokens(value)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Tool Calls */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Tool Calls
        </h3>
        {sortedTools.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <dl className="space-y-1.5">
            {sortedTools.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <dt className="text-xs text-muted-foreground truncate" title={name}>
                  {name}
                </dt>
                <dd className="text-xs font-mono font-medium shrink-0">{count}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {/* Turns */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Turns
        </h3>
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">User</dt>
            <dd className="text-xs font-mono font-medium">{userTurns}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">Assistant</dt>
            <dd className="text-xs font-mono font-medium">{assistantTurns}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
