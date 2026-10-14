/**
 * REGRESSION-FREEZE[bongsim-pg-dns-ipv4-first]
 */
import { describe, expect, it } from 'vitest'
import {
  isBongsimPgDrainRetryableConnectError,
  isBongsimPgNetworkUnreachable,
} from '@/lib/bongsim/db/pool'

describe('bongsim-pg-dns-ipv4-first', () => {
  it('treats ENETUNREACH as drain-retryable so SMS kick does not die silently', () => {
    const err = Object.assign(
      new Error('connect ENETUNREACH 2406:da12:b78:de11:5432 - Local (:::0)'),
      { code: 'ENETUNREACH' },
    )
    expect(isBongsimPgNetworkUnreachable(err)).toBe(true)
    expect(isBongsimPgDrainRetryableConnectError(err)).toBe(true)
  })

  it('still retries connect timeout and EMAXCONN', () => {
    expect(
      isBongsimPgDrainRetryableConnectError(new Error('timeout exceeded when trying to connect')),
    ).toBe(true)
    expect(
      isBongsimPgDrainRetryableConnectError(
        new Error('(EMAXCONN) max client connections reached, limit: 200'),
      ),
    ).toBe(true)
  })
})
