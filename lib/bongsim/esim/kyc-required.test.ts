import { describe, expect, it } from 'vitest'
import {
  getKycLabelDistribution,
  shouldShowBadge,
} from '@/lib/bongsim/esim/kyc-required'

function p(kyc: 'O' | 'X' | null) {
  return { flags: kyc != null ? { kyc } : {} }
}

describe('shouldShowBadge — 메모리 라인 11 SSOT', () => {
  it('binary → X/O chip 각각 표시', () => {
    expect(shouldShowBadge(p('X'), 'binary')).toBe('not_required')
    expect(shouldShowBadge(p('O'), 'binary')).toBe('required')
  })

  it('required_only → amber(O)만', () => {
    expect(shouldShowBadge(p('O'), 'required_only')).toBe('required')
    expect(shouldShowBadge(p('X'), 'required_only')).toBeNull()
  })

  it('not_required_only → chip X (일본·베트남·중국 단독)', () => {
    expect(shouldShowBadge(p('X'), 'not_required_only')).toBeNull()
    expect(getKycLabelDistribution([p('X'), p('X')])).toBe('not_required_only')
  })

  it('none → chip X (인증 무관)', () => {
    expect(shouldShowBadge(p(null), 'none')).toBeNull()
    expect(shouldShowBadge(p('X'), 'none')).toBeNull()
  })
})
