import fs from 'node:fs'
import readline from 'node:readline'
import path from 'node:path'
import type {
  Session, SessionMeta, Message, ToolCall, SessionTokens, MessageRole,
} from './types'
import { estimateCostUsd } from './pricing'
import { prettifyProjectId } from './paths'

export interface ParseOptions {
  mode: 'meta' | 'full'
}

interface RawLine {
  type?: string
  uuid?: string
  timestamp?: string
  message?: {
    role?: string
    model?: string
    content?: unknown
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

export async function parseSessionFile(
  filePath: string,
  opts: ParseOptions,
): Promise<Session | SessionMeta | null> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  const messages: Message[] = []
  const toolCalls: ToolCall[] = []
  const tokens: SessionTokens = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }

  let model = ''
  let startedAt: Date | null = null
  let endedAt: Date | null = null
  let userTurns = 0
  let assistantTurns = 0
  let messageCount = 0
  let partial = false

  for await (const raw of rl) {
    if (!raw.trim()) continue
    let line: RawLine
    try {
      line = JSON.parse(raw)
    } catch {
      partial = true
      continue
    }

    if (line.type !== 'user' && line.type !== 'assistant' && line.type !== 'system') {
      continue
    }

    const ts = line.timestamp ? new Date(line.timestamp) : null
    if (!ts || isNaN(ts.getTime())) {
      partial = true
      continue
    }
    if (!startedAt || ts < startedAt) startedAt = ts
    if (!endedAt || ts > endedAt) endedAt = ts

    const msg = line.message ?? {}
    const role: MessageRole =
      line.type === 'system'
        ? 'system'
        : line.type === 'assistant'
          ? 'assistant'
          : 'user'

    if (role === 'user') userTurns++
    if (role === 'assistant') assistantTurns++

    if (msg.model && !model) model = msg.model

    if (msg.usage) {
      tokens.input        += msg.usage.input_tokens ?? 0
      tokens.output       += msg.usage.output_tokens ?? 0
      tokens.cacheCreate  += msg.usage.cache_creation_input_tokens ?? 0
      tokens.cacheRead    += msg.usage.cache_read_input_tokens ?? 0
    }

    if (Array.isArray(msg.content)) {
      for (const c of msg.content as any[]) {
        if (c?.type === 'tool_use') {
          toolCalls.push({ name: c.name ?? 'unknown', timestamp: ts })
        }
      }
    }

    messageCount++

    if (opts.mode === 'full') {
      if (Array.isArray(msg.content)) {
        for (const c of msg.content as any[]) {
          if (!c || typeof c !== 'object') continue
          if (c.type === 'tool_use') {
            messages.push({
              uuid: `${line.uuid}:${c.id ?? messages.length}`,
              role: 'assistant',
              timestamp: ts,
              content: `[tool_use:${c.name}]`,
              toolName: c.name,
              toolInput: c.input,
            })
          } else if (c.type === 'tool_result') {
            messages.push({
              uuid: `${line.uuid}:r${messages.length}`,
              role: 'tool_result',
              timestamp: ts,
              content: typeof c.content === 'string'
                ? c.content
                : JSON.stringify(c.content ?? ''),
              toolOutput: c.content,
            })
          } else if (c.type === 'text') {
            messages.push({
              uuid: `${line.uuid}:t${messages.length}`,
              role,
              timestamp: ts,
              content: c.text ?? '',
            })
          } else if (c.type === 'thinking') {
            messages.push({
              uuid: `${line.uuid}:think${messages.length}`,
              role: 'assistant',
              timestamp: ts,
              content: c.thinking ?? '',
              isThinking: true,
            })
          }
        }
      } else {
        messages.push({
          uuid: line.uuid ?? String(messages.length),
          role,
          timestamp: ts,
          content: typeof msg.content === 'string' ? msg.content : '',
        })
      }
    }
  }

  if (!startedAt || !endedAt) return null

  const projectId = path.basename(path.dirname(filePath))
  const id = path.basename(filePath, '.jsonl')

  const meta: SessionMeta = {
    id,
    projectId,
    projectLabel: prettifyProjectId(projectId),
    filePath,
    startedAt,
    endedAt,
    durationMs: endedAt.getTime() - startedAt.getTime(),
    model: model || 'unknown',
    messageCount,
    userTurns,
    assistantTurns,
    toolCalls,
    tokens,
    estimatedCostUsd: estimateCostUsd(model || 'unknown', tokens),
    partial,
  }

  if (opts.mode === 'full') {
    return { ...meta, messages } as Session
  }
  return meta
}
