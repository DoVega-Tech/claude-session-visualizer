'use client'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SessionMeta } from '@/lib/sessions/types'

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function formatTokens(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toString()
}

export function SessionTopBar({ session }: { session: SessionMeta }) {
  const totalTokens =
    session.tokens.input + session.tokens.output +
    session.tokens.cacheCreate + session.tokens.cacheRead

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1600px] px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Link>
          <div className="text-xs text-muted-foreground font-mono">
            {session.projectLabel} / {session.id.slice(0, 8)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">{session.model}</Badge>
          <span className="text-muted-foreground">{formatDuration(session.durationMs)}</span>
          <span className="text-muted-foreground">· {formatTokens(totalTokens)} tok</span>
          {session.estimatedCostUsd != null && (
            <span className="text-muted-foreground">
              · ${session.estimatedCostUsd.toFixed(3)}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
