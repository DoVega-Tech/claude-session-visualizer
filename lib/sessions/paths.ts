import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

export const CLAUDE_PROJECTS_DIR = path.join(
  os.homedir(),
  '.claude',
  'projects',
)

/**
 * Claude Code encodes cwd as a project dir name by replacing `/` with `-`.
 * e.g. `-Users-felipevega-Desktop-my-app` → `~/Desktop/my-app`.
 *
 * The encoding is lossy (hyphens in folder names become ambiguous).
 * We try the naive decode first, and if the path exists on disk, use it.
 * Otherwise fall back to replacing just the home-dir prefix.
 */
export function prettifyProjectId(projectId: string): string {
  if (!projectId.startsWith('-')) return projectId
  const home = os.homedir()
  const naivePath = projectId.replace(/-/g, '/')
  try {
    fs.accessSync(naivePath, fs.constants.F_OK)
    if (naivePath.startsWith(home)) return '~' + naivePath.slice(home.length)
    return naivePath
  } catch {
    const homeEncoded = home.replace(/\//g, '-')
    if (projectId.startsWith(homeEncoded + '-')) {
      return '~/' + projectId.slice(homeEncoded.length + 1)
    }
    return projectId
  }
}
