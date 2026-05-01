import { notFound } from 'next/navigation'
import { loadFullSession } from '@/lib/sessions/load'
import { SessionView } from '@/components/session/session-view'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>
}) {
  const { projectId, sessionId } = await params
  const session = await loadFullSession(
    decodeURIComponent(projectId),
    decodeURIComponent(sessionId),
  )
  if (!session) notFound()

  const serialized = {
    ...session,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt.toISOString(),
    toolCalls: session.toolCalls.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
    messages: session.messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
  }
  return <SessionView session={serialized} />
}
