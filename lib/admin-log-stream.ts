/**
 * In-memory log store for admin bot stdout.
 * Used by run-once (streaming) and GET /api/admin/logs/stream (SSE).
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  level: LogLevel
  text: string
  ts: number
}

const MAX_LINES = 2000
const lines: LogEntry[] = []
const subscribers = new Set<(entry: LogEntry) => void>()

let currentProductId: string | null = null

function detectLevel(text: string): LogLevel {
  if (/\[ERROR\]/.test(text)) return 'ERROR'
  if (/\[WARN(ING)?\]/.test(text)) return 'WARN'
  return 'INFO'
}

/** Parse "Start id=clxxx site=hanatour" to extract product id for status indicator */
export function trySetCurrentProductIdFromLine(text: string): void {
  const m = text.match(/Start\s+id=(\S+)/)
  if (m) {
    currentProductId = m[1]
  }
}

export function append(line: string): void {
  const level = detectLevel(line)
  const entry: LogEntry = { level, text: line, ts: Date.now() }
  lines.push(entry)
  if (lines.length > MAX_LINES) lines.shift()
  subscribers.forEach((cb) => cb(entry))
}

export function getLines(): LogEntry[] {
  return [...lines]
}

export function subscribe(cb: (entry: LogEntry) => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

export function getCurrentProductId(): string | null {
  return currentProductId
}

export function clear(): void {
  lines.length = 0
  currentProductId = null
}
