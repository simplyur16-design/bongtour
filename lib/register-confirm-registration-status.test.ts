import { describe, expect, it } from 'vitest'
import { resolveRegistrationStatusForRegisterConfirm } from '@/lib/register-confirm-registration-status'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'

describe('resolveRegistrationStatusForRegisterConfirm', () => {
  it('geo OK + 출발·일정 있어도 신규는 검증 전 pending이 아니다', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: true,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
        hasDeparturesToSave: true,
        hasItineraryDaysToSave: true,
      }),
    ).toBe(REGISTER_PRE_PHOTO_BLOCKED_STATUS)
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

  it('geo 실패 시 검증 전 pending이 아니다', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: false,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
        hasDeparturesToSave: true,
        hasItineraryDaysToSave: true,
      }),
    ).toBe(REGISTER_PRE_PHOTO_BLOCKED_STATUS)
  })

  it('출발 없으면 검증 전 pending이 아니다', () => {
    expect(
      resolveRegistrationStatusForRegisterConfirm({
        masterRegistrationOk: true,
        needsOperatorReview: false,
        existingRegistrationStatus: null,
        hasDeparturesToSave: false,
        hasItineraryDaysToSave: true,
      }),
    ).toBe(REGISTER_PRE_PHOTO_BLOCKED_STATUS)
  })
})
