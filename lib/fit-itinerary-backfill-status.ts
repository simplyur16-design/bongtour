/**
 * 매시간 FIT 추천일정 백필 대상 상태 — 판매 중(공개·registered) 상품은 절대 건드리지 않는다.
 * REGRESSION-FREEZE[fit-itinerary-backfill-skip-public-1101]: 봉실장 11/01 20:39 "공개 상품은 매시간 작업에서 빼고" — manifest
 */

/** 백필이 손대도 되는 상태: 등록 전(pending)·사진 전 막힘(pre_photo_blocked)·빈 값 */
export const FIT_ITINERARY_BACKFILL_STATUSES = ['pending', 'pre_photo_blocked', ''] as const

/** prisma where 용 — registered 등 공개 상태는 넣지 않는다 */
export function fitItineraryBackfillStatusWhere() {
  return {
    OR: [
      { registrationStatus: 'pending' },
      { registrationStatus: 'pre_photo_blocked' },
      { registrationStatus: '' },
      { registrationStatus: null },
    ],
  }
}

/** 조회 후 한 번 더 거르는 안전장치 */
export function isFitItineraryBackfillStatus(status: string | null | undefined): boolean {
  if (status == null) return true
  return (FIT_ITINERARY_BACKFILL_STATUSES as readonly string[]).includes(status.trim())
}
