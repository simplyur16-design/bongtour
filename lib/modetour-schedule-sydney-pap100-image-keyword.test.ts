/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: ModeTour PAP100 Sydney — QVB≠Victoria BC Inner Harbour — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: ModeTour PAP100 Sydney day-route — Jervis≠bare city · QVB≠Victoria BC — manifest
 *
 * Fixture: modetour package 104044219 (PAP100JQ6C Sydney 6일).
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'

const PAP100_ROWS = [
  {
    day: 1,
    title: '호주 상품 예약 시 꼭 읽어주세요',
    routeText: '호주 상품 예약 시 꼭 읽어주세요',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '시드니 · 록스 거리',
    routeText:
      '시드니 - 본다이 비치 - 시드니 하버크루즈 - 오페라하우스 - 하버브릿지 - MRS 맥콰리 체어 - 록스 거리',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '남부 시드니 · 저비스베이 돌핀크루즈',
    routeText: '남부 시드니 - 쿨랑가타 와이너리 - 화이트 샌드 워크 - 저비스베이 돌핀크루즈',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '시드니 · 로라 빌리지',
    routeText: '시드니 - 블루마운틴 - 시드니 ZOO - 로라 빌리지',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '시드니 · 달링하버',
    routeText:
      '시드니 - 퀸 빅토리아 빌딩 - 세인트 메리 대성당 - 하이드 파크 - NSW 미술관 - 바랑가루 - 달링하버',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '귀국',
    routeText: '',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('ModeTour PAP100 Sydney day-route keywords', () => {
  it('maps QVB/Jervis/Darling without Victoria BC bleed', () => {
    expect(mapKoreanPoiSegment('퀸 빅토리아 빌딩')).toMatch(/Queen Victoria Building/i)
    expect(mapKoreanPoiSegment('달링하버')).toMatch(/Darling Harbour/i)
    expect(mapKoreanPoiSegment('저비스베이 돌핀크루즈')).toMatch(/Jervis Bay/i)
    expect(firstMatchingScheduleSpotEn('퀸 빅토리아 빌딩')).toMatch(/Queen Victoria Building/i)
    expect(String(firstMatchingScheduleSpotEn('퀸 빅토리아 빌딩') ?? '')).not.toMatch(
      /Inner Harbour|Victoria BC/i,
    )
    expect(firstMatchingScheduleSpotEn('저비스베이')).toMatch(/Jervis Bay/i)
  })

  it('Day3 Jervis landmarks · Day5 QVB≠Victoria BC (supplierKey: modetour)', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      PAP100_ROWS.map((r) => ({ ...r })),
      {
        supplierKey: 'modetour',
        productDestination: '시드니',
        productTitle: '[유류세_고정] [베스트셀러] 시드니 일주 6일 (전일정4성)',
        travelScope: 'package',
      },
    )
    const blob = (d: number) => {
      const r = out.find((x) => Number(x.day) === d)!
      return `${r.imageKeyword ?? ''} ${r.imageKeyword2 ?? ''}`
    }

    expect(blob(2)).toMatch(/Bondi|Opera|Harbour Bridge|Macquarie|Rocks/i)
    expect(blob(3)).toMatch(/Jervis|Coolangatta|White Sand/i)
    expect(blob(3)).not.toMatch(/^Sydney\s*$/i)
    expect(blob(4)).toMatch(/Blue Mountain|Taronga|Laura/i)
    expect(blob(5)).toMatch(/Queen Victoria|Darling|Barangaroo|St Marys|Hyde Park|Art Gallery/i)
    expect(blob(5)).not.toMatch(/Inner Harbour/i)
  })
})
