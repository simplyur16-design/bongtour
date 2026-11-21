import { describe, expect, it } from 'vitest'
import { HanjintourBlockedError } from '@/lib/hanjintour-http'
import { SupplierFetchError, type SupplierFetchFailure } from '@/lib/supplier-http/supplier-fetch'
import { hanjinFailureName, hanjinWalkStopReason } from '@/lib/hanjintour-ingest-stop'

function failure(partial: Partial<SupplierFetchFailure>): SupplierFetchError {
  return new SupplierFetchError({
    ok: false,
    supplier: 'hanjintour',
    part: 'list',
    url: 'https://example.test/list',
    status: null,
    errorKind: 'timeout',
    message: 'timed out',
    attempts: [],
    elapsedMs: 1,
    ...partial,
  })
}

describe('hanjin ingest stop reason', () => {
  it('403, 429, timeout stop the walk', () => {
    expect(hanjinWalkStopReason(new HanjintourBlockedError(403, 'list'))).toBe('blocked_403')
    expect(hanjinWalkStopReason(new HanjintourBlockedError(429, 'list'))).toBe('blocked_429')
    expect(hanjinWalkStopReason(failure({ errorKind: 'timeout', status: null }))).toBe('timeout')
    expect(hanjinWalkStopReason(failure({ errorKind: 'http_429', status: 429 }))).toBe('http_429')
    expect(hanjinWalkStopReason(failure({ errorKind: 'http_4xx', status: 403 }))).toBe('blocked_403')
  })

  it('other failures keep a short name and drop the address', () => {
    const reason = hanjinFailureName(failure({ errorKind: 'http_5xx', status: 503 }))
    expect(reason).toBe('SupplierFetchError')
    expect(reason).not.toContain('http')
  })
})
