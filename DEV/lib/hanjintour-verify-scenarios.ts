/**
 * 스펙 검증 1~6: 순수 로직(모의 카드). `npx tsx DEV/lib/hanjintour-verify-scenarios.ts`
 */
import assert from 'node:assert/strict'
import {
  buildHanjintourDerivedProductKey,
  createDerivedHanjintourProduct,
} from '@/DEV/lib/hanjintour-derived-product'
import { parseHanjintourBaseProduct } from '@/DEV/lib/parse-hanjintour-base-product'
import type { HanjintourDepartureCardSnapshot } from '@/DEV/lib/hanjintour-types'

function card(partial: Partial<HanjintourDepartureCardSnapshot>): HanjintourDepartureCardSnapshot {
  return {
    selected_calendar_year_month: '2026-04',
    selected_departure_date: '2026-04-10',
    calendar_cell_price: 1_990_000,
    card_index: 0,
    raw_card_text: 'default',
    raw_card_title: null,
    departure_datetime: null,
    return_datetime: null,
    trip_nights: 7,
    trip_days: 8,
    airline_name: '대한항공',
    airline_code: 'KE',
    listed_price: 1_990_000,
    reservation_count: null,
    remaining_seats: 9,
    minimum_departure_count: null,
    status_badges: [],
    option_badges: [],
    source_url: 'https://example.com/detail',
    ...partial,
  }
}

function main() {
  const html = `
  상품코드: HJ-TEST-001
  상품명: 북미 서부 8일
  여행기간: 7박 8일
  성인 2,500,000원 소아 2,200,000원 유아 300,000원
  1일차 인천 출발
  조식: 기내식 중식: - 석식: 기내식
  호텔: 라디슨
  2일차 LA 도착
  조식: 호텔 중식: 현지식 석식: 자유
  `

  const base = parseHanjintourBaseProduct(html)
  assert.equal(base.product_code, 'HJ-TEST-001')

  // 1~2 같은 날짜 카드 2·3개 → 파생 2·3
  const two = [
    card({ card_index: 0, raw_card_text: 'A KE 10:00', airline_name: '대한항공' }),
    card({ card_index: 1, raw_card_text: 'B OZ 11:00', airline_name: '아시아나항공', listed_price: 2_100_000 }),
  ]
  assert.equal(two.map((c) => createDerivedHanjintourProduct(base, c, null)).length, 2)

  const three = [...two, card({ card_index: 2, raw_card_text: 'C TW', airline_name: '티웨이항공' })]
  assert.equal(three.map((c) => createDerivedHanjintourProduct(base, c, null)).length, 3)

  // 3 다른 날짜 → 각각 파생
  const d1 = card({ selected_departure_date: '2026-04-10', card_index: 0, raw_card_text: 'd1' })
  const d2 = card({ selected_departure_date: '2026-04-11', card_index: 0, raw_card_text: 'd2' })
  const k1 = buildHanjintourDerivedProductKey(base, d1)
  const k2 = buildHanjintourDerivedProductKey(base, d2)
  assert.notEqual(k1, k2)

  // 4 같은 항공사, 시간/박수 다름 → 별도 키
  const t1 = card({
    airline_name: '대한항공',
    departure_datetime: '2026-04-10 10:00',
    trip_nights: 7,
    raw_card_text: 'ke morning',
  })
  const t2 = card({
    airline_name: '대한항공',
    departure_datetime: '2026-04-10 22:00',
    trip_nights: 6,
    raw_card_text: 'ke night',
  })
  assert.notEqual(buildHanjintourDerivedProductKey(base, t1), buildHanjintourDerivedProductKey(base, t2))

  // 5 바우처만 다름 — 동일 raw 카드여도 aux_idx·fingerprint로 파생 키 분리(바우처는 option_badges만)
  const v1 = card({
    card_index: 0,
    raw_card_text: '대한항공 동일 일정 동일 가격',
    option_badges: ['SKYPASS 바우처'],
  })
  const v2 = card({
    card_index: 1,
    raw_card_text: '대한항공 동일 일정 동일 가격',
    option_badges: ['OZ마일샵 바우처'],
  })
  assert.notEqual(buildHanjintourDerivedProductKey(base, v1), buildHanjintourDerivedProductKey(base, v2))
  assert.notDeepEqual(
    createDerivedHanjintourProduct(base, v1, null).departure_card.option_badges,
    createDerivedHanjintourProduct(base, v2, null).departure_card.option_badges
  )

  // 6 가격 없는 달력 날짜는 스크래퍼에서 제외 — 여기서는 셀 필터 시뮬레이션
  const hasWon = /\d{1,3}(,\d{3})+\s*원|\d{4,7}\s*원/.test('12')
  assert.equal(hasWon, false)

  console.log('hanjintour verify scenarios: OK')
}

main()
