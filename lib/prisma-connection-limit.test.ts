import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  resolvePrismaConnectionLimit,
  resolvePrismaReadConnectionLimit,
  withPrismaConnectionLimit,
} from '@/lib/prisma-connection-limit'

describe('prisma-connection-limit', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT
    delete process.env.BONGTOUR_PRISMA_READ_CONNECTION_LIMIT
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

  it('rewrites session pooler to transaction mode and sets pgbouncer=true', () => {
    process.env.NODE_ENV = 'production'
    const url = withPrismaConnectionLimit(
      'postgresql://postgres.abc:secret@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres',
    )
    expect(url).toContain(':6543/')
    expect(url).toContain('pgbouncer=true')
    expect(url).toContain('connection_limit=3')
    expect(url).not.toContain(':5432')
  })

  // REGRESSION-FREEZE[prisma-read-write-split]: read limit falls back to write limit
  it('read connection limit falls back to write limit when unset', () => {
    process.env.NODE_ENV = 'production'
    process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT = '2'
    expect(resolvePrismaReadConnectionLimit()).toBe(2)
  })

  it('read connection limit uses BONGTOUR_PRISMA_READ_CONNECTION_LIMIT when set', () => {
    process.env.NODE_ENV = 'production'
    process.env.BONGTOUR_PRISMA_CONNECTION_LIMIT = '5'
    process.env.BONGTOUR_PRISMA_READ_CONNECTION_LIMIT = '2'
    expect(resolvePrismaReadConnectionLimit()).toBe(2)
  })

  it('withPrismaConnectionLimit accepts explicit limit override for read URL', () => {
    process.env.NODE_ENV = 'production'
    const url = withPrismaConnectionLimit('postgresql://u:p@host/db', { limit: 2 })
    expect(url).toContain('connection_limit=2')
  })
})
