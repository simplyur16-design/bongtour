/**
 * 등록 confirm 저장 시 registrationStatus SSOT.
 * REGRESSION-FREEZE[product-listing-cache-revalidate]: geo·출발·일정 OK면 registered — manifest
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
  return 'registered'
}
