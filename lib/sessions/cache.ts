import type { SessionMeta } from './types'

interface Entry { mtimeMs: number; meta: SessionMeta }

export class SessionCache {
  private map = new Map<string, Entry>()

  get(filePath: string, mtimeMs: number): SessionMeta | undefined {
    const entry = this.map.get(filePath)
    if (!entry) return undefined
    if (entry.mtimeMs !== mtimeMs) return undefined
    return entry.meta
  }

  set(filePath: string, mtimeMs: number, meta: SessionMeta): void {
    this.map.set(filePath, { mtimeMs, meta })
  }

  clear(): void { this.map.clear() }

  size(): number { return this.map.size }
}

/** Module-level singleton for server components to share across requests. */
export const sessionCache = new SessionCache()
