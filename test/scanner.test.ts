import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { scanProjectsDir } from '@/lib/sessions/scanner'

describe('scanProjectsDir', () => {
  it('returns empty array when dir does not exist', async () => {
    const result = await scanProjectsDir('/nonexistent/path/abc123')
    expect(result).toEqual([])
  })

  it('enumerates jsonl files across project subdirs', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-'))
    await fs.mkdir(path.join(tmp, '-Users-x-proj'), { recursive: true })
    await fs.writeFile(path.join(tmp, '-Users-x-proj', 'abc.jsonl'), '')
    await fs.writeFile(path.join(tmp, '-Users-x-proj', 'def.jsonl'), '')
    await fs.mkdir(path.join(tmp, '-Users-x-other'), { recursive: true })
    await fs.writeFile(path.join(tmp, '-Users-x-other', 'xyz.jsonl'), '')
    await fs.writeFile(path.join(tmp, '-Users-x-proj', 'notes.txt'), '')

    const result = await scanProjectsDir(tmp)
    expect(result).toHaveLength(3)
    expect(result.every(r => r.filePath.endsWith('.jsonl'))).toBe(true)
    expect(result.every(r => typeof r.mtimeMs === 'number')).toBe(true)

    await fs.rm(tmp, { recursive: true, force: true })
  })
})
