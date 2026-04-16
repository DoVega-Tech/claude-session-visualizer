import path from 'node:path'
import os from 'node:os'

export const CLAUDE_PROJECTS_DIR = path.join(
  os.homedir(),
  '.claude',
  'projects',
)

/**
 * Claude Code encodes cwd as a project dir name like
 * `-Users-felipevega-Desktop-my-app`. Turn it into `~/Desktop/my-app`.
 */
export function prettifyProjectId(projectId: string): string {
  if (!projectId.startsWith('-')) return projectId
  const asPath = projectId.replace(/-/g, '/')
  const home = os.homedir()
  if (asPath.startsWith(home)) return '~' + asPath.slice(home.length)
  return asPath
}
