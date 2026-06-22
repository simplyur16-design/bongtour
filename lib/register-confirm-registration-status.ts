/**
 * 등록 confirm 저장 시 registrationStatus SSOT.
 * REGRESSION-FREEZE[register-confirm-pending-status]: 신규·재등록 모두 등록대기 — manifest
 *
 * 사실가져오기 → 봉투어 형식 변환 → confirm 저장은 pending.
 * 공개 노출(registered)은 등록대기에서 사진·검수 후 승인.
 */
export function resolveRegistrationStatusForRegisterConfirm(args: {
  masterRegistrationOk: boolean
  needsOperatorReview: boolean
  existingRegistrationStatus?: string | null
  hasDeparturesToSave: boolean
  hasItineraryDaysToSave: boolean
}): 'pending' | 'registered' {
  if (!args.masterRegistrationOk || args.needsOperatorReview) return 'pending'
  if (!args.hasDeparturesToSave || !args.hasItineraryDaysToSave) return 'pending'
  if (args.existingRegistrationStatus === 'registered') return 'registered'
  return 'pending'
}
