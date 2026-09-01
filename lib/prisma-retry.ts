import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const RETRYABLE = new Set(['P1001', 'P1002', 'P1017', 'P2024'])

/** REGRESSION-FREEZE[naeiltour-register-confirm-no-interactive-tx]: 25P02·pooler 끊김 재시도 — manifest */
/** REGRESSION-FREEZE[register-pre-photo-heal-prisma-retry]: P1001·P1017·EMAXCONN 도 끊고 재시도 — manifest */
export function isRetryablePrismaError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE.has(e.code)
  }
  const msg = e instanceof Error ? e.message : String(e)
  return /Can't reach database server|Connection pool timeout|Timed out fetching|current transaction is aborted|25P02|EMAXCONN|max client connections reached/i.test(
    msg,
  )
}

function retryDelayMs(attempt: number, e?: unknown): number {
  const msg = e instanceof Error ? e.message : String(e ?? '')
  if (/EMAXCONN|max client connections reached/i.test(msg)) {
    return Math.min(45000, 8000 * attempt)
  }
  const base = parseInt(process.env.BONGTOUR_PRISMA_RETRY_BASE_MS ?? '1500', 10) || 1500
  return Math.min(12000, base * attempt)
}

export async function withPrismaRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let last: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (!isRetryablePrismaError(e) || attempt >= maxAttempts) throw e
      const msg = e instanceof Error ? e.message : String(e)
      if (
        /current transaction is aborted|25P02|Can't reach database server|Server has closed the connection|EMAXCONN|max client connections reached/i.test(
          msg,
        ) ||
        (e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P1001' || e.code === 'P1017'))
      ) {
        try {
          await prisma.$disconnect()
        } catch {
          /* pooler 끊긴 연결 버리고 다음 시도 */
        }
      }
      const wait = retryDelayMs(attempt, e)
      console.warn(`[prisma-retry] ${label} attempt=${attempt}/${maxAttempts} waitMs=${wait}`, e)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw last
}
