import { PrismaClient } from '@prisma/client'
import { withPrismaConnectionLimit } from '@/lib/prisma-connection-limit'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const databaseUrl = withPrismaConnectionLimit(process.env.DATABASE_URL)

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
