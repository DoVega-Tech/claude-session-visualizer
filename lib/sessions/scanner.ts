import fs from 'node:fs/promises'
import path from 'node:path'

export interface ScannedFile {
  projectId: string
  sessionId: string
  filePath: string
  mtimeMs: number
  sizeBytes: number
}

export async function scanProjectsDir(root: string): Promise<ScannedFile[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(root)
  } catch {
    return []
  }

  const results: ScannedFile[] = []
  for (const entry of entries) {
    const projectDir = path.join(root, entry)
    let stat
    try {
      stat = await fs.stat(projectDir)
    } catch { continue }
    if (!stat.isDirectory()) continue

    let files: string[]
    try {
      files = await fs.readdir(projectDir)
    } catch { continue }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const filePath = path.join(projectDir, file)
      try {
        const s = await fs.stat(filePath)
        if (!s.isFile()) continue
        results.push({
          projectId: entry,
          sessionId: file.replace(/\.jsonl$/, ''),
          filePath,
          mtimeMs: s.mtimeMs,
          sizeBytes: s.size,
        })
      } catch { continue }
    }
  }
  return results
}
