/**
 * REGRESSION-FREEZE[register-schedule-bali-image-keyword]: 발리 남부투어·귀국일 imageKeyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { englishFromScheduleKoreanSegment } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

const BALI_SCHEDULE = [
  { day: 1, title: '-', description: 'x', routeText: '발리 주요 관광지 지도 - 발리지도', imageKeyword: '', imageKeyword2: null },
  {
    day: 2,
    title: '-',
    description: 'x',
    routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '-',
    description: 'x',
    routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '-',
    description: 'x',
    routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '-',
    description: 'x',
    routeText: '남부투어 - 가루다 공원 - 울루와뚜 절벽사원 - 멜라스티 비치 음료 - 발리 - 발리 해변',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 6, title: '-', description: 'x', routeText: '발리', imageKeyword: '', imageKeyword2: null },
]

describe('Bali register schedule imageKeyword', () => {
  it('maps southern tour Korean route segments to English landmarks', () => {
    expect(englishFromScheduleKoreanSegment('가루다 공원')).toMatch(/Garuda Wisnu Kencana/i)
    expect(englishFromScheduleKoreanSegment('멜라스티 비치 음료')).toMatch(/Melasti Beach/i)
  })

  it('hanatour 6-day — day5 southern tour + day6 return must not be empty', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(BALI_SCHEDULE, {
      supplierKey: 'hanatour',
      productDestination: '발리',
      productTitle: '발리 6일',
    })
    const day5 = out.find((r) => r.day === 5)
    const day6 = out.find((r) => r.day === 6)
    expect(String(day5?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(String(day6?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(String(day5?.imageKeyword ?? '')).toMatch(/Garuda|Uluwatu|Melasti/i)
    // return may soft-dup visit city with departure — landmark middle days stay unique vs return landmark
    const returnNk = normScheduleImageKeywordKey(String(day6?.imageKeyword ?? ''))
    for (const row of out) {
      if (Number(row.day) === 6) continue
      if (Number(row.day) <= 1) continue
      for (const slot of [row.imageKeyword, row.imageKeyword2]) {
        const nk = normScheduleImageKeywordKey(String(slot ?? '').trim())
        if (!nk || !returnNk) continue
        if (nk === returnNk) {
          expect(String(slot)).toMatch(/^Bali$/i)
        }
      }
    }
  })
})
