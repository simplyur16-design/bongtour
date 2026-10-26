import { describe, expect, it } from 'vitest'
import {
  decideHealFieldWrite,
  isUnknownHealValue,
  mergeRegisteredHealNeedsReviewIntoRawMeta,
  truncateHealAuditValue,
} from '@/lib/register-pending-heal-write-guard'

describe('decideHealFieldWrite', () => {
  it('never writes title', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'pending',
      field: 'title',
      before: 'a',
      after: 'b',
      reason: 'clean',
      provenance: 'derived_ops',
    })
    expect(r).toEqual({ action: 'skip', logReason: 'heal-never-write-product-title' })
  })

  it('skips unchanged', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'pending',
      field: 'destination',
      before: '다낭',
      after: '다낭',
      reason: 'title_inferred_dest',
      provenance: 'inferred',
    })
    expect(r.action).toBe('skip')
    expect(r.logReason).toBe('unchanged')
  })

  it('registered + inferred destination → skipped-registered-needs-review', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'registered',
      field: 'destination',
      before: '미입력',
      after: '다낭',
      reason: 'title_inferred_dest',
      provenance: 'inferred',
    })
    expect(r).toEqual({ action: 'skip', logReason: 'skipped-registered-needs-review' })
  })

  it('registered + inferred departure airport → skip', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'registered',
      field: 'localDepartureTag',
      before: [],
      after: ['busan'],
      reason: 'departure_airport_infer',
      provenance: 'inferred',
    })
    expect(r.logReason).toBe('skipped-registered-needs-review')
  })

  it('pending + inferred destination may write', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'pending',
      field: 'destination',
      before: '미입력',
      after: '다낭',
      reason: 'title_inferred_dest',
      provenance: 'inferred',
    })
    expect(r.action).toBe('write')
  })

  it('unknown stays unknown — do not fill empty over existing', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'pending',
      field: 'destination',
      before: '다낭',
      after: '',
      reason: 'title_inferred_dest',
      provenance: 'inferred',
    })
    expect(r).toEqual({ action: 'skip', logReason: 'unknown-stays-unknown' })
  })

  it('registered cannot demote registrationStatus', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'registered',
      field: 'registrationStatus',
      before: 'registered',
      after: 'pre_photo_blocked',
      reason: 'verify_gate',
      provenance: 'derived_ops',
    })
    expect(r.logReason).toBe('registered-no-demotion')
  })

  it('derived_ops schedule write on registered allowed', () => {
    const r = decideHealFieldWrite({
      registrationStatus: 'registered',
      field: 'schedule',
      before: '[]',
      after: '[{"day":1}]',
      reason: 'schedule_heal',
      provenance: 'derived_ops',
    })
    expect(r.action).toBe('write')
  })
})

describe('helpers', () => {
  it('isUnknownHealValue', () => {
    expect(isUnknownHealValue(null)).toBe(true)
    expect(isUnknownHealValue('')).toBe(true)
    expect(isUnknownHealValue([])).toBe(true)
    expect(isUnknownHealValue('다낭')).toBe(false)
  })

  it('truncateHealAuditValue', () => {
    expect(truncateHealAuditValue('abc')).toBe('abc')
    expect(truncateHealAuditValue('x'.repeat(200)).endsWith('…')).toBe(true)
  })

  it('mergeRegisteredHealNeedsReviewIntoRawMeta without schema change', () => {
    const out = mergeRegisteredHealNeedsReviewIntoRawMeta('{"prePhoto":{"ok":true}}', [
      'destination',
      'localDepartureTag',
    ])
    const parsed = JSON.parse(out) as {
      healRegisteredNeedsReview: { skippedFields: string[]; note: string }
      prePhoto: { ok: boolean }
    }
    expect(parsed.prePhoto.ok).toBe(true)
    expect(parsed.healRegisteredNeedsReview.note).toBe('skipped-registered-needs-review')
    expect(parsed.healRegisteredNeedsReview.skippedFields).toEqual([
      'destination',
      'localDepartureTag',
    ])
  })
})
