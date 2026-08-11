/**
 * REGRESSION-FREEZE[register-schedule-route-expression-normalize]: AMP7017 hotel-only ≠ KK lounge steal — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: ModeTour AMP7017 KK day-route — hopping≠hotel · lounge owns waterfront — manifest
 *
 * Fixture: modetour package 106612757 (AMP7017C53 Kota Kinabalu 3박5일).
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import {
  isRegisterScheduleHotelOnlyRouteText,
  prepareRegisterScheduleRowsForImageKeywordApply,
} from '@/lib/register-schedule-route-text-backfill'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'

const AMP7017_ROWS = [
  {
    day: 1,
    title: '판보르네오 호텔',
    routeText: '코타키나발루 - 판보르네오 호텔',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '아일랜드 호핑',
    routeText: '아일랜드 호핑',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '판보르네오 호텔',
    routeText: '판보르네오 호텔',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: 'KK 스타 라운지',
    routeText: '코타키나발루 - KK 스타 라운지',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '귀국',
    routeText: '',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('ModeTour AMP7017 Kota Kinabalu keywords', () => {
  it('hotel-only route must not steal adjacent lounge/hopping segments', () => {
    expect(isRegisterScheduleHotelOnlyRouteText('판보르네오 호텔')).toBe(true)
    expect(mapKoreanPoiSegment('KK 스타 라운지')).toMatch(/Signal Hill/i)

    const prepared = prepareRegisterScheduleRowsForImageKeywordApply(
      AMP7017_ROWS.map((r) => ({ ...r })),
    )
    const d3 = prepared.find((r) => Number(r.day) === 3)!
    expect(String(d3.routeText ?? '')).not.toMatch(/KK\s*스타|라운지|아일랜드\s*호핑/i)
  })

  it('Day2 hopping / Day4 lounge day-owned; hotel days no hopping bleed (supplierKey: modetour)', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      AMP7017_ROWS.map((r) => ({ ...r })),
      {
        supplierKey: 'modetour',
        productDestination: '코타키나발루',
        productTitle:
          '[기간한정특가][노쇼핑+호핑투어+시내라운지+레체] 코타키나발루 판보르네오 시티뷰 3박5일',
        travelScope: 'package',
      },
    )
    const blob = (d: number) => {
      const r = out.find((x) => Number(x.day) === d)!
      return `${r.imageKeyword ?? ''} ${r.imageKeyword2 ?? ''}`.toLowerCase()
    }

    expect(blob(1)).not.toMatch(/island\s*hopping|hopping/)
    expect(blob(2)).toMatch(/hopping|island/)
    expect(blob(3)).not.toMatch(/island\s*hopping|signal\s*hill/)
    expect(blob(4)).toMatch(/signal\s*hill/)
    expect(blob(4)).not.toMatch(/island\s*hopping/)
  })
})
