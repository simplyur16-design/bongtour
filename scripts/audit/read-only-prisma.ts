/**
 * Phase A audit helper — READ ONLY transactions only.
 * Never import write helpers. Host reported separately by audit scripts.
 */
import { PrismaClient } from '@prisma/client'
import '../load-env-for-scripts'

export function databaseHostOnly(): { host: string; port: string; name: string } {
  const raw = (process.env.DATABASE_URL ?? '').trim()
  if (!raw) return { host: '(unset)', port: '', name: '' }
  try {
    const u = new URL(raw)
    return {
      host: u.hostname,
      port: u.port,
      name: u.pathname.replace(/^\//, '').split('?')[0] || '',
    }
  } catch {
    return { host: '(unparseable)', port: '', name: '' }
  }
}

export async function withReadOnlyPrisma<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = new PrismaClient()
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      return fn(tx as unknown as PrismaClient)
    })
  } finally {
    await prisma.$disconnect()
  }
}
