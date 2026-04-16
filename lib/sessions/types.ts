export type MessageRole = 'user' | 'assistant' | 'tool_result' | 'system'

export interface ToolCall {
  name: string
  timestamp: Date
  durationMs?: number
}

export interface Message {
  uuid: string
  role: MessageRole
  timestamp: Date
  /** Plain text content for display. Tool blocks become stringified. */
  content: string
  /** Only set for tool_use / tool_result messages. */
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  /** True when the assistant block was a thinking block. */
  isThinking?: boolean
}

export interface SessionTokens {
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
}

/** Dashboard-mode session: everything except `messages[]`. */
export interface SessionMeta {
  id: string
  projectId: string
  projectLabel: string
  filePath: string
  startedAt: Date
  endedAt: Date
  durationMs: number
  model: string
  messageCount: number
  userTurns: number
  assistantTurns: number
  toolCalls: ToolCall[]
  tokens: SessionTokens
  estimatedCostUsd: number | null
  /** True if any line was skipped due to malformed JSON. */
  partial: boolean
}

/** Detail-mode session: meta + full message list. */
export interface Session extends SessionMeta {
  messages: Message[]
}
