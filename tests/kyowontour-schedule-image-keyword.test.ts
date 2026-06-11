/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — kyowontour prebuild
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyKyowontourScheduleImageKeywordsToRows } from '../lib/kyowontour-schedule-image-keyword'

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

describe('applyKyowontourScheduleImageKeywordsToRows', () => {
  it('관광 일차 routeText 2 POI → kw1/kw2 (1≠2)', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '레',
          description: '레 왕궁과 레 시장',
          routeText: '레 - 레 왕궁 - 레 시장',
          imageKeyword: 'Leh Palace',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'India' },
    )
    assert.ok(out[0]!.imageKeyword?.trim(), `kw1: ${out[0]!.imageKeyword}`)
    assert.ok(out[0]!.imageKeyword2?.trim(), `kw2: ${out[0]!.imageKeyword2}`)
    assert.notEqual(norm(out[0]!.imageKeyword!), norm(out[0]!.imageKeyword2!))
  })

  it('출발일 — imageKeyword2 null', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 국제공항 출발',
          routeText: '인천 - 레',
          imageKeyword: 'Leh',
          imageKeyword2: 'Leh Palace',
        },
      ],
      { productDestination: 'India' },
    )
    assert.equal(out[0]!.imageKeyword2, null)
  })

  it('dedupe·route 폴백 없이도 관광 2일차 각각 kw2 채움', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '레',
          description: '레 왕궁',
          routeText: '레 - 레 왕궁 - 레 시장',
          imageKeyword: 'Leh Palace',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '달',
          description: '달 호수',
          routeText: '달 - 판공초 사원',
          imageKeyword: 'Pangong Lake',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'India', productTitle: '라다크' },
    )
    assert.ok(out[0]!.imageKeyword2?.trim(), `day2 kw2: ${out[0]!.imageKeyword2}`)
    assert.ok(out[1]!.imageKeyword2?.trim(), `day3 kw2: ${out[1]!.imageKeyword2}`)
  })
})
