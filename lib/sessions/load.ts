import 'server-only'
import { scanProjectsDir } from './scanner'
import { parseSessionFile } from './parser'
import { sessionCache } from './cache'
import { CLAUDE_PROJECTS_DIR } from './paths'
import type { SessionMeta, Session } from './types'

/** Returns dashboard-mode metadata for every session found. */
export async function loadAllSessionMetas(): Promise<SessionMeta[]> {
  const files = await scanProjectsDir(CLAUDE_PROJECTS_DIR)
  const out: SessionMeta[] = []
  for (const f of files) {
    const cached = sessionCache.get(f.filePath, f.mtimeMs)
    if (cached) { out.push(cached); continue }
    const parsed = await parseSessionFile(f.filePath, { mode: 'meta' })
    if (parsed) {
      sessionCache.set(f.filePath, f.mtimeMs, parsed as SessionMeta)
      out.push(parsed as SessionMeta)
    }
  }
  return out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

/** Full session load for the detail route. Bypasses cache (cache holds meta only). */
export async function loadFullSession(
  projectId: string,
  sessionId: string,
): Promise<Session | null> {
  const files = await scanProjectsDir(CLAUDE_PROJECTS_DIR)
  const match = files.find(f => f.projectId === projectId && f.sessionId === sessionId)
  if (!match) return null
  const parsed = await parseSessionFile(match.filePath, { mode: 'full' })
  return (parsed as Session) ?? null
}

/** Used by the Refresh action to invalidate the meta cache. */
export function clearSessionCache(): void {
  sessionCache.clear()
}
