import { PrismaClient } from '@prisma/client'

/** 빌드 시 병렬 SSG가 pgbouncer pool_size(15)를 넘지 않도록 Prisma 풀 상한 */
const DEFAULT_CONNECTION_LIMIT = 1

function withConnectionLimit(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return databaseUrl
  if (/[?&]connection_limit=/i.test(databaseUrl)) return databaseUrl
  const separator = databaseUrl.includes('?') ? '&' : '?'
  return `${databaseUrl}${separator}connection_limit=${DEFAULT_CONNECTION_LIMIT}`
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const databaseUrl = withConnectionLimit(process.env.DATABASE_URL)

const debugQueryLogEnabled = process.env.DEBUG_QUERY_LOG === '1'

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    ...(debugQueryLogEnabled ? { log: [{ emit: 'event', level: 'query' as const }] } : {}),
  })
  return client
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
