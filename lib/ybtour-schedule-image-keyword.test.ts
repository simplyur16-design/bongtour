/**
 * REGRESSION-FREEZE[ybtour-schedule-image-keyword-distinct]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'

describe('applyYbtourScheduleImageKeywordsToRows — routeText 슬롯', () => {
  it('routeText 순서만 — LLM 입력 무시', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발',
          routeText: '인천 - 오사카',
          imageKeyword: 'Dotonbori',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '오사카 관광',
          description: '오사카성과 도톤보리',
          routeText: '오사카 - 오사카성 - 도톤보리',
          imageKeyword: 'Dotonbori',
          imageKeyword2: 'Osaka Castle',
        },
        {
          day: 3,
          title: '귀국',
          description: '인천 도착',
          routeText: '오사카 - 인천',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '일본' },
    )

    const d2 = rows.find((r) => r.day === 2)!
    assert.notEqual(d2.imageKeyword, 'Dotonbori')
    assert.ok(d2.imageKeyword?.trim())
    assert.ok(d2.imageKeyword2?.trim())
    assert.equal(rows.find((r) => r.day === 3)?.imageKeyword2 ?? null, null)
  })

  it('movement/return 일차는 imageKeyword2 null', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 홍콩 도착',
          description: '인천 국제공항에서 출발하여 홍콩 국제공항 도착',
          routeText: '인천 - 홍콩',
          imageKeyword: 'Harbour City',
          imageKeyword2: 'SoHo',
        },
        {
          day: 4,
          title: '인천 국제공항 도착',
          description: '홍콩 출발 후 인천 국제공항 도착',
          routeText: '홍콩 - 인천',
          imageKeyword: 'Victoria Peak',
          imageKeyword2: 'SoHo',
        },
      ],
      { productDestination: 'Hong Kong' },
    )

    expectKw2Null(rows[0])
    expectKw2Null(rows[1])
    assert.equal(rows[0]?.imageKeyword, 'Hong Kong')
  })

  it('일본 — routeText에 매핑된 명소만 슬롯 채움 (추측·본문 금지)', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 출발',
          routeText: '인천 - 치토세 - 죠잔케이',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '관광',
          description: '▶ 후라노',
          routeText: '죠잔케이 - 후라노 - 오타루',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '귀국',
          description: '인천 도착',
          routeText: '오타루 - 치토세 - 인천',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      { productDestination: '일본' },
    )

    assert.match(rows[1]?.imageKeyword ?? '', /Furano|Otaru|Jozankei/i)
    assert.ok(!rows[1]?.imageKeyword2?.trim() || /Otaru|Furano/i.test(rows[1]?.imageKeyword2 ?? ''))
    assert.match(rows[2]?.imageKeyword ?? '', /Otaru|Jozankei|Furano/i)
    assert.equal(rows[2]?.imageKeyword2, null)
  })
})

function expectKw2Null(row: { imageKeyword2?: string | null } | undefined) {
  assert.equal(row?.imageKeyword2 ?? null, null)
}
