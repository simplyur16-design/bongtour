import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  commitPendingOnlyProductScheduleWrite,
  computeMaterializedRevision,
  isReviewRevisionStale,
  stampRematRevisionOnRawMeta,
  RAW_META_LAST_REVIEWED_HASH_KEY,
  RAW_META_MATERIALIZED_REVISION_KEY,
} from '@/lib/register-pending-write-guard'
import { isAutoRegisterReviewPassed } from '@/lib/register-auto-register-review-pass'
import { autoRegisterSwitches } from '@/lib/register-auto-photo-register-job'

describe('register-pending-write-guard revision', () => {
  it('stamps materializedRevision and clears lastReviewedHash', () => {
    const schedule = JSON.stringify([{ day: 1, title: 'A' }])
    const next = stampRematRevisionOnRawMeta({ keep: 1 }, schedule, {
      packageSupplierScheduleRemat: { at: 't', supplier: 'hanatour', days: 1 },
    })
    expect(next.keep).toBe(1)
    expect(next[RAW_META_MATERIALIZED_REVISION_KEY]).toBe(computeMaterializedRevision(schedule))
    expect(next[RAW_META_LAST_REVIEWED_HASH_KEY]).toBeNull()
    expect(isReviewRevisionStale(next)).toBe(true)
  })

  it('not stale when lastReviewedHash matches materializedRevision', () => {
    const rev = computeMaterializedRevision('[]')
    expect(
      isReviewRevisionStale({
        [RAW_META_MATERIALIZED_REVISION_KEY]: rev,
        [RAW_META_LAST_REVIEWED_HASH_KEY]: rev,
      }),
    ).toBe(false)
  })

  it('not stale when no materializedRevision (legacy pass list still valid)', () => {
    expect(isReviewRevisionStale({})).toBe(false)
    expect(isReviewRevisionStale(null)).toBe(false)
  })
})

describe('isAutoRegisterReviewPassed + remat revision', () => {
  const passedId = 'cmv9jwr9n0i2p1wlkj6ix1gg4' // allowlist #27
  it('allowlist alone still passes when rawMeta omitted (compat)', () => {
    expect(isAutoRegisterReviewPassed(passedId)).toBe(true)
  })
  it('rejects allowlist id after remat until lastReviewedHash matches', () => {
    const schedule = '[{"day":1}]'
    const mat = computeMaterializedRevision(schedule)
    expect(
      isAutoRegisterReviewPassed(passedId, {
        rawMeta: JSON.stringify({
          [RAW_META_MATERIALIZED_REVISION_KEY]: mat,
          [RAW_META_LAST_REVIEWED_HASH_KEY]: null,
        }),
      }),
    ).toBe(false)
    expect(
      isAutoRegisterReviewPassed(passedId, {
        rawMeta: JSON.stringify({
          [RAW_META_MATERIALIZED_REVISION_KEY]: mat,
          [RAW_META_LAST_REVIEWED_HASH_KEY]: mat,
        }),
      }),
    ).toBe(true)
  })
})

describe('commitPendingOnlyProductScheduleWrite transaction order', () => {
  const findUnique = vi.fn()
  const updateMany = vi.fn()
  const tx = { product: { findUnique, updateMany } }
  const prismaClient = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }

  beforeEach(() => {
    findUnique.mockReset()
    updateMany.mockReset()
    prismaClient.$transaction.mockClear()
  })

  it('rereads status then conditional updateMany; count===1 commits', async () => {
    findUnique.mockResolvedValue({
      id: 'p1',
      registrationStatus: 'pre_photo_blocked',
      schedule: '[]',
      rawMeta: '{}',
    })
    updateMany.mockResolvedValue({ count: 1 })
    const res = await commitPendingOnlyProductScheduleWrite({
      productId: 'p1',
      expectedSchedule: '[]',
      nextSchedule: '[{"day":1}]',
      nextRawMeta: '{"x":1}',
      prismaClient: prismaClient as never,
    })
    expect(res).toEqual({ ok: true, count: 1 })
    expect(prismaClient.$transaction).toHaveBeenCalledTimes(1)
    expect(findUnique.mock.invocationCallOrder[0]).toBeLessThan(updateMany.mock.invocationCallOrder[0])
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'p1',
        registrationStatus: { in: ['pending', 'pre_photo_blocked'] },
        schedule: '[]',
      },
      data: { schedule: '[{"day":1}]', rawMeta: '{"x":1}' },
    })
  })

  it('aborts with count 0 and no further writes when registered mid-reparse', async () => {
    findUnique.mockResolvedValue({
      id: 'p1',
      registrationStatus: 'registered',
      schedule: '[]',
      rawMeta: '{}',
    })
    const res = await commitPendingOnlyProductScheduleWrite({
      productId: 'p1',
      expectedSchedule: '[]',
      nextSchedule: '[{"day":1}]',
      prismaClient: prismaClient as never,
    })
    expect(res).toEqual({ ok: false, reason: 'aborted_status', count: 0 })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('aborts concurrent transition when updateMany affected count is 0', async () => {
    findUnique.mockResolvedValue({
      id: 'p1',
      registrationStatus: 'pending',
      schedule: '[]',
      rawMeta: '{}',
    })
    updateMany.mockResolvedValue({ count: 0 })
    const res = await commitPendingOnlyProductScheduleWrite({
      productId: 'p1',
      expectedSchedule: '[]',
      nextSchedule: '[{"day":1}]',
      prismaClient: prismaClient as never,
    })
    expect(res).toEqual({ ok: false, reason: 'aborted_concurrent', count: 0 })
  })

  it('does not use SET SESSION style — interactive $transaction callback only', async () => {
    findUnique.mockResolvedValue({
      id: 'p1',
      registrationStatus: 'pending',
      schedule: null,
      rawMeta: '{}',
    })
    updateMany.mockResolvedValue({ count: 1 })
    await commitPendingOnlyProductScheduleWrite({
      productId: 'p1',
      expectedSchedule: null,
      nextSchedule: '[]',
      prismaClient: prismaClient as never,
    })
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('lib/register-pending-write-guard.ts', 'utf8'),
    )
    expect(src).toContain('$transaction')
    expect(src).not.toMatch(/SET\s+SESSION/i)
    expect(src).not.toMatch(/BEGIN\s+READONLY/i) // write path is interactive tx, not READONLY
  })
})

describe('auto photo switches stay default off (fail gate boolean)', () => {
  it('fill/flip/record are false without env=1', () => {
    const sw = autoRegisterSwitches({})
    expect(sw.fill).toBe(false)
    expect(sw.flip).toBe(false)
    expect(sw.record).toBe(false)
  })
})
