import { loadAllSessionMetas } from '@/lib/sessions/load'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { CLAUDE_PROJECTS_DIR } from '@/lib/sessions/paths'

export default async function DashboardPage() {
  const sessions = await loadAllSessionMetas()
  const serialized = sessions.map(s => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt.toISOString(),
    toolCalls: s.toolCalls.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
  }))
  return <DashboardClient sessions={serialized} projectsDir={CLAUDE_PROJECTS_DIR} />
}
