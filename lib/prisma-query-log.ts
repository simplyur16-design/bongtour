import 'server-only'

import { AsyncLocalStorage } from 'async_hooks'
import type { PrismaClient } from '@prisma/client'

type QueryEntry = {
  durationMs: number
  summary: string
}

type QueryLogScope = {
  label: string
  queries: QueryEntry[]
}

const queryLogStorage = new AsyncLocalStorage<QueryLogScope>()

let listenerAttached = false

export function isPrismaQueryLogEnabled(): boolean {
  return process.env.DEBUG_QUERY_LOG === '1'
}

/** Prisma `$on('query')` — 활성 scope가 있을 때만 집계 */
export function recordPrismaQueryEvent(durationMs: number, sql: string): void {
  const scope = queryLogStorage.getStore()
  if (!scope) return
  const summary = formatQuerySummary(sql, durationMs)
  scope.queries.push({ durationMs, summary })
}

/** `lib/prisma.ts`는 클라이언트에서도 import 되므로, 리스너는 서버 전용 진입점에서만 연결 */
export function ensurePrismaQueryLogListener(): void {
  if (!isPrismaQueryLogEnabled() || listenerAttached) return
  listenerAttached = true
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require('@/lib/prisma') as { prisma: PrismaClient }
  type QueryLogClient = PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
  ;(prisma as QueryLogClient).$on('query', (e) => {
    recordPrismaQueryEvent(e.duration, e.query)
  })
}

function extractTableName(sql: string): string | null {
  const from = sql.match(/FROM\s+"public"\."([^"]+)"/i) ?? sql.match(/FROM\s+"([^"]+)"/i)
  if (from?.[1]) return from[1]
  const into = sql.match(/INTO\s+"public"\."([^"]+)"/i) ?? sql.match(/INTO\s+"([^"]+)"/i)
  if (into?.[1]) return into[1]
  const update = sql.match(/UPDATE\s+"public"\."([^"]+)"/i) ?? sql.match(/UPDATE\s+"([^"]+)"/i)
  if (update?.[1]) return update[1]
  return null
}

function inferOperation(sql: string): string {
  const head = sql.trimStart().slice(0, 12).toUpperCase()
  if (head.startsWith('SELECT')) return 'findMany'
  if (head.startsWith('INSERT')) return 'create'
  if (head.startsWith('UPDATE')) return 'update'
  if (head.startsWith('DELETE')) return 'delete'
  return 'query'
}

function formatQuerySummary(sql: string, durationMs: number): string {
  const table = extractTableName(sql)
  const op = inferOperation(sql)
  const label = table ? `${table}.${op}` : 'sql'
  return `${label}(${Math.round(durationMs)}ms)`
}

function flushQueryLogSummary(scope: QueryLogScope): void {
  const { label, queries } = scope
  if (queries.length === 0) {
    console.log(`[query-log ${label}] count=0 total=0ms slowest=`)
    return
  }
  const totalMs = queries.reduce((sum, q) => sum + q.durationMs, 0)
  const slowest = [...queries]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 3)
    .map((q) => q.summary)
    .join(', ')
  console.log(
    `[query-log ${label}] count=${queries.length} total=${Math.round(totalMs)}ms slowest=${slowest}`,
  )
}

/** 상품 상세 등 — 요청 단위 Prisma 쿼리 집계 (DEBUG_QUERY_LOG=1) */
export async function runWithQueryLogScope<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isPrismaQueryLogEnabled()) {
    return fn()
  }
  ensurePrismaQueryLogListener()
  return queryLogStorage.run({ label, queries: [] }, async () => {
    try {
      return await fn()
    } finally {
      const scope = queryLogStorage.getStore()
      if (scope) flushQueryLogSummary(scope)
    }
  })
}
