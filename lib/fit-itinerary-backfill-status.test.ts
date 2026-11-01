import { describe, expect, it } from 'vitest'
import { fitItineraryBackfillStatusWhere, isFitItineraryBackfillStatus } from './fit-itinerary-backfill-status'

describe('fit itinerary hourly backfill — 공개 상품 제외', () => {
  it('registered·auto_unpublished·on_hold·rejected 는 대상 아님', () => {
    for (const s of ['registered', 'auto_unpublished', 'on_hold', 'rejected', 'published']) {
      expect(isFitItineraryBackfillStatus(s)).toBe(false)
    }
  })
  it('pending·pre_photo_blocked·빈 값만 대상', () => {
    for (const s of ['pending', 'pre_photo_blocked', '', null, undefined]) {
      expect(isFitItineraryBackfillStatus(s)).toBe(true)
    }
  })
  it('prisma where 에 registered 가 없다', () => {
    const statuses = fitItineraryBackfillStatusWhere().OR.map((o) => o.registrationStatus)
    expect(statuses).not.toContain('registered')
    expect(statuses).toEqual(['pending', 'pre_photo_blocked', '', null])
  })
})
