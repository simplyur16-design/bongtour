import { describe, expect, it } from 'vitest'
import { resolveRegistrationStatusForRegisterConfirm } from '@/lib/register-confirm-registration-status'

describe('resolveRegistrationStatusForRegisterConfirm', () => {
  it('geo OK + 출발·일정 있으면 신규도 registered', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: true,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
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
