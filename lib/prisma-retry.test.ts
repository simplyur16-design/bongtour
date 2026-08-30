import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { isRetryablePrismaError } from '@/lib/prisma-retry'

describe('isRetryablePrismaError', () => {
  it('retries pooler 25P02 aborted transaction', () => {
    expect(
      isRetryablePrismaError(
        new Error(
          'Invalid `prisma.product.findMany()` invocation:\ncurrent transaction is aborted, commands ignored until end of transaction block',
        ),
      ),
    ).toBe(true)
    expect(isRetryablePrismaError(new Error('PostgresError { code: "25P02" }'))).toBe(true)
  })

  it('retries known connection codes', () => {
    expect(
      isRetryablePrismaError(
        new Prisma.PrismaClientKnownRequestError('gone', { code: 'P1017', clientVersion: '5.22.0' }),
      ),
    ).toBe(true)
    expect(
      isRetryablePrismaError(
        new Prisma.PrismaClientKnownRequestError('unreachable', { code: 'P1001', clientVersion: '5.22.0' }),
      ),
    ).toBe(true)
  })

  it('does not retry unrelated errors', () => {
    expect(isRetryablePrismaError(new Error('unique constraint'))).toBe(false)
  })
})
