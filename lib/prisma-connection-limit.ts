/**
 * Prisma pooler connection_limit SSOT.
 * schema.prisma 주석(기본 5)과 코드 불일치가 간헐 502·허브 멈춤 원인이었음.
 *
 * Supabase 세션 풀은 pool_size 15다. Prisma + `lib/bongsim/db/pool` 이 한 인스턴스에서
 * 그 15를 다 쓰면 배포 중 겹치는 구(舊) 인스턴스와 `prisma migrate deploy` 스키마 엔진이
 * 슬롯을 못 받아 EMAXCONNSESSION 으로 죽는다. 두 인스턴스가 겹쳐도 여유가 남게 잡는다.
 */
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'

const BUILD_SAFE_DEFAULT = 1
const PRODUCTION_DEFAULT = 3

export function resolvePrismaConnectionLimit(): number {
  if (shouldSkipDbAtBuild()) return 1
  const raw = process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT?.trim()
  if (raw) {
    const n = parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n
  }
  if (process.env.NODE_ENV === 'production') return PRODUCTION_DEFAULT
  return BUILD_SAFE_DEFAULT
}

export function withPrismaConnectionLimit(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return databaseUrl
  if (/[?&]connection_limit=/i.test(databaseUrl)) return databaseUrl
  const separator = databaseUrl.includes('?') ? '&' : '?'
  return `${databaseUrl}${separator}connection_limit=${resolvePrismaConnectionLimit()}`
}
