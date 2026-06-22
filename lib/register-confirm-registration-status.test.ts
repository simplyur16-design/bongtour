import { describe, expect, it } from 'vitest'
import { resolveRegistrationStatusForRegisterConfirm } from '@/lib/register-confirm-registration-status'

describe('resolveRegistrationStatusForRegisterConfirm', () => {
  it('geo OK + 출발·일정 있어도 신규는 pending (등록대기)', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: true,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
        hasDeparturesToSave: true,
        hasItineraryDaysToSave: true,
      }),
    ).toBe('pending')
  })

  it('이미 registered면 재confirm 시 registered 유지', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: true,
        needsOperatorReview: false,
        existingRegistrationStatus: 'registered',
        hasDeparturesToSave: true,
        hasItineraryDaysToSave: true,
      }),
    ).toBe('registered')
  })

  it('geo 실패 시 pending', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: false,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
        hasDeparturesToSave: true,
        hasItineraryDaysToSave: true,
      }),
    ).toBe('pending')
  })

  it('출발 없으면 pending', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: true,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
        hasDeparturesToSave: false,
        hasItineraryDaysToSave: true,
      }),
    ).toBe('pending')
  })
})
