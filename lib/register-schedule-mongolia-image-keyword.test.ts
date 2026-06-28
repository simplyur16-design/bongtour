/**
 * REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: 몽골 테렐지 CQP111 — POI·캠프 제외 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { englishFromScheduleKoreanSegment, normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

/** hanatour CQP1112608017CB — live API routeText 요약 */
const MONGOLIA_SCHEDULE = [
  {
    day: 1,
    routeText:
      '몽골 FAQ - 시내를 떠나기 전 필수 코스! 쇼핑 타임 - 현지 대형마트 - 테를지 전경이 펼쳐지는 티벳불교 사원 - 아리iya발 사원 - 야리야발사원 마니차 - 테렐지 국립공원 명물 - 거북 바위 (Turtle Rock) - 테렐지 미라지 캠프(MIRAGE TOURIST CAMP)',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 2,
    routeText:
      '몽골 대초원 <테렐지 국립공원> - MIRAGE TOURIST CAMP - 테렐지 풍경 - 게르 - 테를지공원 초원 - 신나는 초원 액티비티 즐기기 - 초원 승마체험 테렐지 - 칭기즈칸 청동 기마상 - 기마상 전망대 및 박물관',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '울란바토르 시내관광 - 수흐바타르 광장',
    routeText: '자이승승전탑 자이승전망대 - 수흐바타르 광장',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 4, title: '울란바토르', routeText: null, imageKeyword: '', imageKeyword2: null },
]

describe('Mongolia Terelj register schedule imageKeyword', () => {
  it('maps Terelj Korean route segments to English landmarks', () => {
    expect(englishFromScheduleKoreanSegment('테렐지 국립공원')).toMatch(/Terelj National Park/i)
    expect(englishFromScheduleKoreanSegment('거북 바위')).toMatch(/Turtle Rock/i)
    expect(englishFromScheduleKoreanSegment('자이승전망대')).toMatch(/Zaisan Memorial/i)
  })

  it('hanatour CQP111-like — landmarks not tourist camps', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(MONGOLIA_SCHEDULE, {
      supplierKey: 'hanatour',
      productDestination: '몽골',
      productTitle: '몽골/테렐지 4일',
    })
    const d1 = out.find((r) => r.day === 1)
    const d2 = out.find((r) => r.day === 2)
    const d3 = out.find((r) => r.day === 3)

    expect(String(d1?.imageKeyword ?? '')).toMatch(/Ariyabal|Terelj National Park/i)
    expect(String(d1?.imageKeyword ?? '')).not.toMatch(/MIRAGE|TOURIST CAMP/i)
    expect(String(d1?.imageKeyword2 ?? '').trim().length).toBeGreaterThan(0)
    expect(String(d1?.imageKeyword2 ?? '')).not.toMatch(/MIRAGE|TOURIST CAMP/i)
    expect(normScheduleImageKeywordKey(String(d1?.imageKeyword ?? ''))).not.toBe(
      normScheduleImageKeywordKey(String(d1?.imageKeyword2 ?? '')),
    )

    expect(String(d2?.imageKeyword ?? '')).toMatch(/Terelj National Park|Genghis Khan Statue/i)
    expect(String(d2?.imageKeyword ?? '')).not.toMatch(/MIRAGE|TOURIST CAMP/i)
    const d2kw2 = String(d2?.imageKeyword2 ?? '').trim()
    if (d2kw2) {
      expect(d2kw2).toMatch(/Turtle Rock|Genghis Khan Statue|Terelj National Park/i)
      expect(d2kw2).not.toMatch(/MIRAGE|TOURIST CAMP/i)
    }

    expect(String(d3?.imageKeyword ?? '')).toMatch(/Zaisan Memorial/i)
    expect(String(d3?.imageKeyword2 ?? '')).toMatch(/Sukhbaatar Square/i)

    const used = new Set<string>()
    for (const row of out) {
      for (const slot of [row.imageKeyword, row.imageKeyword2]) {
        const kw = String(slot ?? '').trim()
        if (!kw) continue
        const nk = normScheduleImageKeywordKey(kw)
        expect(used.has(nk)).toBe(false)
        used.add(nk)
      }
    }
  })
})
