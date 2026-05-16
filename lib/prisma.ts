import { PrismaClient } from '@prisma/client'

/** 빌드 시 병렬 SSG가 pgbouncer pool_size(15)를 넘지 않도록 Prisma 풀 상한 */
const DEFAULT_CONNECTION_LIMIT = 5

function withConnectionLimit(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return databaseUrl
  if (/[?&]connection_limit=/i.test(databaseUrl)) return databaseUrl
  const separator = databaseUrl.includes('?') ? '&' : '?'
  return `${databaseUrl}${separator}connection_limit=${DEFAULT_CONNECTION_LIMIT}`
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const databaseUrl = withConnectionLimit(process.env.DATABASE_URL)

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
