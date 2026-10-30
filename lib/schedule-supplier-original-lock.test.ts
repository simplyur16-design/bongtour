import { describe, expect, it } from 'vitest'
import {
  isScheduleSupplierOriginalLocked,
  readScheduleSupplierOriginalLock,
  withScheduleSupplierOriginalLock,
} from '@/lib/schedule-supplier-original-lock'

describe('schedule-supplier-original-lock', () => {
  it('not locked for empty / bad / missing', () => {
    expect(isScheduleSupplierOriginalLocked(null)).toBe(false)
    expect(isScheduleSupplierOriginalLocked('')).toBe(false)
    expect(isScheduleSupplierOriginalLocked('not json')).toBe(false)
    expect(isScheduleSupplierOriginalLocked('{"a":1}')).toBe(false)
    expect(isScheduleSupplierOriginalLocked('{"scheduleSupplierOriginalLock":{"source":"x","lockedAt":"t"}}')).toBe(false)
  })
  it('locks and keeps other keys', () => {
    const next = withScheduleSupplierOriginalLock('{"keep":1}', { lockedAt: '2026-10-30T10:00:00.000Z', source: 'supplier_original' })
    expect(JSON.parse(next).keep).toBe(1)
    expect(isScheduleSupplierOriginalLocked(next)).toBe(true)
    expect(readScheduleSupplierOriginalLock(next)?.lockedAt).toBe('2026-10-30T10:00:00.000Z')
  })
})
