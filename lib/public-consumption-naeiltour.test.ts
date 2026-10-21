import { describe, expect, it } from 'vitest'
import {
  resolveHotelConsumption,
  resolveOptionalToursConsumption,
  resolveShoppingConsumption,
} from '@/lib/public-consumption-naeiltour'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import { NAEILTOUR_HOTEL_UNDECIDED_PLACEHOLDER, resolveDayHotelPlansForPublic } from '@/lib/day-hotel-plans-naeiltour'

// REGRESSION-FREEZE[public-consumption-naeiltour]: 공개 소비·일차호텔 — manifest
describe('resolvePublicConsumptionModuleKey naeiltour', () => {
  it('brandKey naeiltour → naeiltour (hanatour 폴백 금지)', () => {
    expect(resolvePublicConsumptionModuleKey('naeiltour', null)).toBe('naeiltour')
    expect(resolvePublicConsumptionModuleKey(null, 'naeiltour')).toBe('naeiltour')
  })
})

describe('public-consumption-naeiltour', () => {
  it('canonical shopping 우선', () => {
    const d = resolveShoppingConsumption({
      canonical: {
        rows: [{ shoppingItem: '보석', shoppingPlace: '시내샵' }],
      },
      legacyDbRows: [{ itemType: '레거시', placeName: 'DB', durationText: null, refundPolicyText: null, raw: 'x' }],
      legacyMetaRows: [],
    })
    expect(d.source).toBe('canonical_shopping')
    expect(d.value).toHaveLength(1)
    expect(d.value[0]?.placeName).toBe('시내샵')
  })

  it('canonical optional 우선', () => {
    const d = resolveOptionalToursConsumption({
      canonical: { rows: [{ tourName: '헬기투어', adultPrice: 100 }] },
      legacyOptionalToursStructured: JSON.stringify([{ id: '1', name: '레거시' }]),
    })
    expect(d.source).toBe('canonical_optional')
    expect(d.value).toContain('헬기투어')
  })

  it('hotel canonical → day-hotel-plans-naeiltour 미정 일정과 정합', () => {
    const hotel = resolveHotelConsumption({
      canonical: {
        rows: [{ dayLabel: '2일차', hotelNameText: 'ABC Hotel' }],
      },
      legacyStructuredPlans: null,
      hasLegacyNarrativeFallback: false,
    })
    expect(hotel.source).toBe('canonical_hotel')
    const plans = resolveDayHotelPlansForPublic(hotel.value, null, null, [
      { day: 1, hotelText: '미정' },
      { day: 2, hotelText: 'ABC Hotel' },
    ])
    expect(plans.some((p) => p.hotels.includes('ABC Hotel'))).toBe(true)
    expect(plans.every((p) => !p.hotels.includes(NAEILTOUR_HOTEL_UNDECIDED_PLACEHOLDER) || p.dayIndex !== 2)).toBe(
      true
    )
  })
})
