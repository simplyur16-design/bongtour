/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: ModeTour AIP102 Manado day-route POI — bare city≠Jesus/Siladen — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Manado cluster day-route evidence — AIP102 landmark bleed 금지 — manifest
 *
 * Fixture: modetour package 106840196 (AIP102ZEFN Manado 5일).
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { isHotelLodgingImageKeyword } from '@/lib/pexels-place-name-keyword'

const AIP102_ROWS = [
  {
    day: 1,
    title: '마나도 · 포포인츠 마나도',
    routeText: '마나도 - 포포인츠 마나도',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '마나도',
    routeText: '마나도',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '마나도 · 마나도 베이',
    routeText: '마나도 - 부나켄 해양 국립공원 - 마나도 베이',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '마나도 · 축복하는 예수상',
    routeText:
      '마나도 - 반힝키옹 사원 - 성모 마리아 대성당 - 센트럼 마나도 교회 (마나도 최초 교회) - 마카테테 힐 - 축복하는 예수상',
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

describe('ModeTour AIP102 Manado day-route keywords', () => {
  it('maps Manado city POIs without auxiliary bleed strings', () => {
    expect(mapKoreanPoiSegment('축복하는 예수상')).toBe('Blessing Jesus Statue')
    expect(mapKoreanPoiSegment('마카테테 힐')).toBe('Makatete Hill')
    expect(mapKoreanPoiSegment('반힝키옹 사원')).toBe('Ban Hing Kiong Temple')
    expect(firstMatchingScheduleSpotEn('부나켄')).toMatch(/Bunaken National Marine Park/i)
    expect(firstMatchingScheduleSpotEn('실라덴')).toMatch(/Siladen Island/i)
    expect(isHotelLodgingImageKeyword('포포인츠 마나도')).toBe(true)
  })

  it('Day2 bare 마나도 must not steal Day4 Jesus or invent Siladen (supplierKey: modetour)', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      AIP102_ROWS.map((r) => ({ ...r })),
      {
        supplierKey: 'modetour',
        productDestination: '인도네시아',
        productTitle:
          '[NO쇼핑NO옵션NO팁] 마나도 포포인츠 시티뷰(더블)[1일자유+호핑투어+시내관광] 5일',
        travelScope: 'package',
      },
    )
    const byDay = (d: number) => out.find((r) => Number(r.day) === d)!
    const blob = (d: number) =>
      `${byDay(d).imageKeyword ?? ''} ${byDay(d).imageKeyword2 ?? ''}`.toLowerCase()

    expect(blob(1)).not.toMatch(/blessing|jesus|siladen|four\s*points|포포인츠/)
    expect(blob(2)).not.toMatch(/blessing|jesus|siladen|bunaken/)
    // Day1 Manado soft-dup 허용 — bare 도시 자유일이면 Manado 유지 (빈칸·타일 bleed 금지)
    expect(blob(2)).toMatch(/manado/)

    expect(blob(3)).toMatch(/bunaken/)
    expect(blob(3)).not.toMatch(/blessing|jesus/)

    expect(blob(4)).toMatch(/blessing|jesus|makatete|hing|cathedral|centrum/)
    expect(blob(4)).not.toMatch(/siladen/)
  })
})
