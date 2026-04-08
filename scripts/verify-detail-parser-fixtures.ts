import { parseFlightSectionModetour } from '@/lib/flight-parser-modetour'
import { parseHotelSection } from '@/lib/hotel-table-parser'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-modetour'
import { splitDetailSections } from '@/lib/detail-body-parser-utils-modetour'

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`Fixture assertion failed: ${name}`)
}

function runSectionSplitFixture(): void {
  const text = `여행핵심정보
항공여정
가는편: 인천 → 연길 2026.04.20 19:20 / CZ6074
예정호텔
1일차 | 연길 | 예정 | 파라다이스 호텔
선택관광
백두산 USD 180
쇼핑정보
쇼핑품목 인삼
포함사항 조식 포함
유의사항 안전수칙`
  const out = splitDetailSections(text)
  const types = out.map((x) => x.type)
  assert('section split includes flight', types.includes('flight_section'))
  assert('section split includes hotel', types.includes('hotel_section'))
  assert('section split includes optional', types.includes('optional_tour_section'))
  assert('section split includes shopping', types.includes('shopping_section'))
}

function runFlightFixture(): void {
  const section = `항공사: 중국남방항공
출발 인천 → 연길 2026.04.20 19:20 CZ6074
입국 연길 → 인천 2026.04.23 13:25 CZ6073`
  const r = parseFlightSectionModetour(section, null)
  assert('flight status success', r.debug?.status === 'success')
  assert('flight outbound no', r.outbound.flightNo === 'CZ6074')
  assert('flight inbound leg exists', Boolean(r.inbound.departureAirport || r.inbound.arrivalAirport || r.inbound.flightNo))
}

function runHotelFixture(): void {
  const section = `예정호텔
1일차 | 2026-04-20 | 연길 | 예정 | 파라다이스 호텔`
  const r = parseHotelSection(section)
  assert('hotel rows >= 1', r.rows.length >= 1)
  assert('hotel first has candidate', (r.rows[0]?.hotelCandidates.length ?? 0) >= 1)
}

function runOptionalFixture(): void {
  const section = `선택관광
1. 유니버설 스튜디오 USD 120 / 시간 6시간
안내문: 본 상품은 현지 사정에 따라 진행되며`
  const r = parseUnstructuredOptionalTourBodyForRegister(section)
  assert('optional row parsed', r.rows.length >= 1)
  assert('optional banned line filtered', !r.rows.some((x) => /안내문|본 상품은/.test(x.descriptionText)))
}

function runShoppingFixture(): void {
  const section = `쇼핑
회차 1 | 쇼핑 품목 잡화 | 쇼핑 장소 면세점 | 소요시간 50분 | 환불여부 가능
쇼핑안내
소비자의 권리 안내 장문`
  const r = parseUnstructuredShoppingBodyForRegister(section)
  assert('shopping row parsed', r.rows.length >= 1)
  assert('shopping narrative filtered', !r.rows.some((x) => /소비자의 권리/.test(`${x.shoppingItem} ${x.refundPolicyText}`)))
}

function main(): void {
  runSectionSplitFixture()
  runFlightFixture()
  runHotelFixture()
  runOptionalFixture()
  runShoppingFixture()
  console.log('detail parser fixtures: all passed')
}

main()
