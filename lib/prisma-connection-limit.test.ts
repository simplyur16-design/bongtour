import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { resolvePrismaConnectionLimit, withPrismaConnectionLimit } from '@/lib/prisma-connection-limit'

describe('prisma-connection-limit', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT
  })

  afterEach(() => {
    process.env = env
  })

  it('defaults to 3 in production — Prisma + pg pool must stay under Supabase pool_size 15', () => {
    process.env.NODE_ENV = 'production'
    expect(resolvePrismaConnectionLimit()).toBe(3)
  })

  it('defaults to 1 outside production', () => {
    process.env.NODE_ENV = 'development'
    expect(resolvePrismaConnectionLimit()).toBe(1)
  })

  it('appends connection_limit to DATABASE_URL', () => {
    process.env.NODE_ENV = 'production'
    const url = withPrismaConnectionLimit('postgresql://u:p@host/db')
    expect(url).toContain('connection_limit=3')
  })
})
