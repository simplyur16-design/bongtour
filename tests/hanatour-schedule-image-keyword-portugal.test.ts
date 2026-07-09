/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: hanatour Portugal 9-day — manifest
 * REGRESSION-FREEZE[schedule-segment-poi-oceania-japan-europe]: Portugal POI — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyRegisterScheduleImageKeywordsBySupplier } from '../lib/register-schedule-image-keywords-apply'

const PORTUGAL_NINE_DAY = [
  { day: 1, routeText: '인천', imageKeyword: '', imageKeyword2: null },
  {
    day: 2,
    routeText:
      '까보다로까 - 까보다로까 로카곶 - 카스카이스 - 카스카이스해변 - 신트라 관광 - 헤갈레이라 별장 - 파티마',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    routeText: '브라가 - 브라가 대성당 - 봉 헤수스 두 몬테 성당 - 기마랑이스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    routeText: '포르투 - 클레리구스 성당 및 종탑 - 포르투 대성당 - 포르투 상 벤투역',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    routeText: '아베이루 - 몰리세이루 유람선 탑승 - 오비두스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    routeText: '알부페이라 - 라고스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    routeText: "사그레스 - 사그레스와 상비센테 곶",
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    routeText: '리스본 - 벨렘탑 - 제로니모스 수도원 - 코메르시우 광장',
    imageKeyword: '',
    imageKeyword2: null,
  },
  { day: 9, routeText: '인천', imageKeyword: '', imageKeyword2: null },
]

describe('hanatour Portugal 9-day imageKeyword SSOT', () => {
  it('출발·중간 2슬롯·귀국(마지막 도시 미사용 명소) — 전 일차 키워드 비지 않음', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(PORTUGAL_NINE_DAY, {
      supplierKey: 'hanatour',
      productDestination: '포르투갈',
      productTitle: '포르투갈 정통 일주 9일',
    })
    for (const row of out) {
      const kw = String(row.imageKeyword ?? '').trim()
      assert.ok(kw.length > 1, `day ${row.day} imageKeyword empty`)
      if (row.day > 1 && row.day < 9) {
        const kw2 = String(row.imageKeyword2 ?? '').trim()
        assert.ok(kw2.length > 1, `day ${row.day} imageKeyword2 empty`)
      }
    }
    const d1 = out.find((r) => r.day === 1)!
    const d9 = out.find((r) => r.day === 9)!
    assert.match(d1.imageKeyword!, /Cabo da Roca|Cascais|Pena|Fatima|Sintra/i)
    assert.match(d9.imageKeyword!, /Belem Tower|Jeronimos|Commerce Square|Lisbon/i)
    assert.doesNotMatch(d9.imageKeyword!, /Cabo da Roca|Porto Cathedral|Sao Bento|Pena Palace/i)
  })
})
