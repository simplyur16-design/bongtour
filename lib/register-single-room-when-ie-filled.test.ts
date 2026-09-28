/**
 * REGRESSION-FREEZE[ybtour-register-single-room-when-ie-filled]
 * REGRESSION-FREEZE[kyowontour-register-single-room-when-ie-filled]
 * REGRESSION-FREEZE[lottetour-register-single-room-when-ie-filled]
 */
import { describe, expect, it } from 'vitest'
import {
  needsYbtourSingleRoomCollect,
} from '@/lib/ybtour-register-detail-collect'
import { extractLottetourFeesFromExcluded } from '@/lib/lottetour-register-api-detail'

describe('single-room collect when IE already filled', () => {
  it('ybtour: needs single when excluded mentions 1인실 but structured empty', () => {
    expect(
      needsYbtourSingleRoomCollect({
        excludedText: '1인실 추가비용 별도\n개인경비',
        hasSingleRoomSurcharge: false,
        singleRoomSurchargeRaw: null,
        singleRoomSurchargeAmount: null,
      } as never),
    ).toBe(true)
  })

  it('ybtour: does not need single when already structured', () => {
    expect(
      needsYbtourSingleRoomCollect({
        excludedText: '1인실 추가비용 별도',
        hasSingleRoomSurcharge: true,
        singleRoomSurchargeRaw: '1인실 280,000원',
        singleRoomSurchargeAmount: 280000,
      } as never),
    ).toBe(false)
  })

  it('lottetour: excluded bullets → singleRoom amount SSOT', () => {
    const fees = extractLottetourFeesFromExcluded(['싱글룸 써차지 500,000원', '가이드팁'])
    expect(fees.singleRoomSurchargeAmount).toBe(500000)
    expect(fees.singleRoomSurchargeRaw).toMatch(/싱글/)
  })
})
