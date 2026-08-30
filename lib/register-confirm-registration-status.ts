/**
 * 등록 confirm 저장 시 registrationStatus SSOT.
 * REGRESSION-FREEZE[register-confirm-pending-status]: 신규는 검증 전 pending 금지 — manifest
 *
 * 신규 저장은 pre_photo_blocked. 일정·이미지키워드 힐+검증 통과만 pending(등록대기).
 * 이미 공개(registered)만 유지. 캐시 무효화는 검증 게이트 뒤에서 실패해도 confirm을 깨지 않는다.
 */
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'

export function resolveRegistrationStatusForRegisterConfirm(args: {
  masterRegistrationOk: boolean
  needsOperatorReview: boolean
  existingRegistrationStatus?: string | null
  hasDeparturesToSave: boolean
  hasItineraryDaysToSave: boolean
}): 'registered' | typeof REGISTER_PRE_PHOTO_BLOCKED_STATUS {
  if (!args.masterRegistrationOk || args.needsOperatorReview) return REGISTER_PRE_PHOTO_BLOCKED_STATUS
  if (!args.hasDeparturesToSave || !args.hasItineraryDaysToSave) return REGISTER_PRE_PHOTO_BLOCKED_STATUS
  if (args.existingRegistrationStatus === 'registered') return 'registered'
  return REGISTER_PRE_PHOTO_BLOCKED_STATUS
}
