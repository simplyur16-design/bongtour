import { Prisma } from '@prisma/client'

const RETRYABLE = new Set(['P1001', 'P1002', 'P1017', 'P2024'])

function isRetryablePrismaError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE.has(e.code)
  }
  const msg = e instanceof Error ? e.message : String(e)
  return /Can't reach database server|Connection pool timeout|Timed out fetching/i.test(msg)
}

function retryDelayMs(attempt: number): number {
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
      const wait = retryDelayMs(attempt)
      console.warn(`[prisma-retry] ${label} attempt=${attempt}/${maxAttempts} waitMs=${wait}`, e)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw last
}
