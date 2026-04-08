/**
 * 등록→저장 체인 회귀: 항공 병합 / 옵션 detail+final / 쇼핑 경고 / 공개 가격 4슬롯.
 * 실행: npx tsx scripts/verify-register-detail-final-chain.ts
 */
import assert from 'node:assert/strict'
import type { DepartureKeyFacts } from '../lib/departure-key-facts'
import { mergeFlightKeyFactsWithStructuredBody } from '../lib/departure-key-facts'
import type { FlightStructuredBody } from '../lib/public-product-extras'
import { legHasGarbageFlightFields } from '../lib/flight-leg-garbage'
import {
  buildOptionalToursStructuredForRegisterJson,
  optionalTourDurationTextLooksLikeLeakedPrice,
} from '../lib/register-optional-tours-detail-final-merge'
import { shouldEmitShoppingBothEmptyExtractionIssue } from '../lib/review-policy-hanatour'
import { computeKRWQuotationPublic, getPublicPerPaxUnitKrw } from '../lib/price-utils'
import { mergeProductPriceRowsWithBodyPriceTable } from '../lib/product-departure-to-price-rows-hanatour'
import { parsedPricesToDepartureInputs } from '../lib/upsert-product-departures-hanatour'
import { resolveFlightDisplayPolicy } from '../lib/admin-flight-profile'
import { tryParseModetourFlightLines } from '../lib/flight-modetour-parser'
import { extractProductPriceTableByLabels } from '../lib/product-price-table-extract'
import { parseUnstructuredShoppingBodyForRegister } from '../lib/register-input-unstructured-body-hanatour'
import type { ProductPriceRow } from '../app/components/travel/TravelProductDetail'

function baseDetailRow(over: Partial<Parameters<typeof buildOptionalToursStructuredForRegisterJson>[0][0]>) {
  return {
    tourName: '테스트관광',
    currency: 'USD',
    adultPrice: null as number | null,
    childPrice: null as number | null,
    durationText: '',
    minPeopleText: '',
    guide同行Text: '',
    waitingPlaceText: '',
    descriptionText: '설명',
    ...over,
  }
}

// —— 항공: 깨진 DB leg는 병합에서 제외되고 본문 leg가 반영되는지 ——
{
  const facts: DepartureKeyFacts = {
    airline: 'KE',
    outbound: {
      departureAirport: '12',
      arrivalAirport: '34',
      departureAtText: '2024',
      arrivalAtText: null,
      flightNo: null,
    },
    inbound: {
      departureAirport: '나리타국제공항',
      arrivalAirport: '인천국제공항',
      departureAtText: '2026.03.08(토) 19:20',
      arrivalAtText: '2026.03.08(토) 22:30',
      flightNo: 'KE456',
    },
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }
  assert.equal(legHasGarbageFlightFields(facts.outbound!), true, 'fixture: garbage outbound')
  const flight: FlightStructuredBody = {
    airlineName: '대한항공',
    departureSegmentText: '가는편: 인천국제공항 → 나리타국제공항 / KE001',
    returnSegmentText: '오는편: 나리타국제공항 → 인천국제공항 / KE456',
  }
  const out = mergeFlightKeyFactsWithStructuredBody(facts, flight, 'KE', {})!
  assert.ok(out.outbound, 'garbage outbound replaced by body merge')
  assert.equal(legHasGarbageFlightFields(out.outbound!), false, '병합 후 가는편 leg는 garbage 아님')
  assert.ok(
    (out.outbound?.departureAirport ?? '').includes('인천'),
    '가는편 출발지에 본문 기반 공항명 반영'
  )
}

// —— 항공: DB·본문 모두 정상일 때 인바운드 등 기존 정상 leg가 불필요하게 깨지지 않음 ——
{
  const facts: DepartureKeyFacts = {
    airline: 'KE',
    outbound: {
      departureAirport: '인천국제공항',
      arrivalAirport: '나리타국제공항',
      departureAtText: '2026.03.01(토) 08:30',
      arrivalAtText: '2026.03.01(토) 11:30',
      flightNo: 'KE001',
    },
    inbound: {
      departureAirport: '나리타국제공항',
      arrivalAirport: '인천국제공항',
      departureAtText: '2026.03.08(토) 19:20',
      arrivalAtText: '2026.03.08(토) 22:30',
      flightNo: 'KE456',
    },
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }
  const flight: FlightStructuredBody = {
    airlineName: '대한항공',
    departureSegmentText: '가는편: 인천국제공항 → 나리타국제공항 / KE001',
    returnSegmentText: '오는편: 나리타국제공항 → 인천국제공항 / KE456',
  }
  const out = mergeFlightKeyFactsWithStructuredBody(facts, flight, 'KE', {})!
  assert.equal(out.inbound?.flightNo, 'KE456', '정상 인바운드 편명 유지')
  assert.equal(legHasGarbageFlightFields(out.inbound!), false, '인바운드는 garbage 아님')
}

// —— 옵션: 일부 행만 가격 null → final에서 채움 ——
{
  const detail = [
    baseDetailRow({ tourName: 'A코스', adultPrice: 100, childPrice: null, durationText: '1시간' }),
    baseDetailRow({ tourName: 'B코스', adultPrice: null, childPrice: null, durationText: '30분' }),
  ]
  const finalJson = JSON.stringify([
    { name: 'A코스', adultPrice: 999, childPrice: 50, durationText: '1시간', raw: 'x' },
    { name: 'B코스', adultPrice: 25, childPrice: 25, durationText: '50분', raw: 'y' },
  ])
  const out = JSON.parse(buildOptionalToursStructuredForRegisterJson(detail, finalJson)) as Array<Record<string, unknown>>
  assert.equal(out[0].adultPrice, 100, 'A 성인가는 detail 유지')
  assert.equal(out[0].childPrice, 50, 'A 아동은 final에서 보강')
  assert.equal(out[1].adultPrice, 25, 'B 성인은 final')
  assert.equal(out[1].childPrice, 25, 'B 아동은 final')
}

// —— 옵션: 전부 가격 null + final 우수 → 전체 final 채택 ——
{
  const detail = [
    baseDetailRow({ tourName: '탭행', adultPrice: null, childPrice: null, durationText: '25' }),
  ]
  const finalJson = JSON.stringify([{ name: '탭행', adultPrice: 25, childPrice: 25, durationText: '50분', raw: 'raw' }])
  const out = JSON.parse(buildOptionalToursStructuredForRegisterJson(detail, finalJson)) as Array<Record<string, unknown>>
  assert.equal(out.length, 1, '행 수 유지')
  assert.equal(out[0].adultPrice, 25, 'final 가격')
  assert.equal(out[0].durationText, '50분', 'duration 오염 대신 final')
}

// —— 옵션: durationText 숫자만 오염 휴리스틱 ——
{
  assert.equal(optionalTourDurationTextLooksLikeLeakedPrice('25', null, null), true)
  assert.equal(optionalTourDurationTextLooksLikeLeakedPrice('50분', null, null), false)
}

// —— 옵션: final이 명백히 나음(가격 행 수·duration 오염) ——
{
  const detail = [
    baseDetailRow({ tourName: 'x', adultPrice: null, childPrice: null, durationText: '99' }),
    baseDetailRow({ tourName: 'y', adultPrice: null, childPrice: null, durationText: '88' }),
  ]
  const finalJson = JSON.stringify([
    { name: 'x', adultPrice: 10, childPrice: 5, durationText: '약 1시간', raw: '' },
    { name: 'y', adultPrice: 20, childPrice: 10, durationText: '40분', raw: '' },
  ])
  const out = JSON.parse(buildOptionalToursStructuredForRegisterJson(detail, finalJson)) as Array<Record<string, unknown>>
  assert.equal(out[0].adultPrice, 10, 'whole-final 채택 시 첫 행 가격')
  assert.match(String(out[0].durationText ?? ''), /시간|분/, '정상 duration')
}

// —— 쇼핑 경고: visit만 / 목록만 / 둘 다 없음 ——
{
  assert.equal(
    shouldEmitShoppingBothEmptyExtractionIssue({
      hasShoppingFromBodyOrSignals: true,
      shopRowCount: 0,
      visitCount: 3,
    }),
    false,
    'visit만 있고 목록 없음 → 불일치 자동 경고 없음(완전공백도 아님)'
  )
  assert.equal(
    shouldEmitShoppingBothEmptyExtractionIssue({
      hasShoppingFromBodyOrSignals: true,
      shopRowCount: 2,
      visitCount: null,
    }),
    false,
    '목록만 있고 visit 없음 → 이 헬퍼는 경고 안 냄'
  )
  assert.equal(
    shouldEmitShoppingBothEmptyExtractionIssue({
      hasShoppingFromBodyOrSignals: true,
      shopRowCount: 0,
      visitCount: null,
    }),
    true,
    '쇼핑 힌트 있는데 목록·visit 둘 다 비어 있으면 경고'
  )
}

// —— 가격: 공개 4슬롯 회귀 (childExtraBed / childNoBed / infant 매핑) ——
{
  const row = {
    adultBase: 100,
    adultFuel: 0,
    priceChildWithBed: 80,
    priceChildNoBed: 70,
    priceInfant: 10,
  }
  assert.equal(getPublicPerPaxUnitKrw(row, 'adult'), 100)
  assert.equal(getPublicPerPaxUnitKrw(row, 'childBed'), 80)
  assert.equal(getPublicPerPaxUnitKrw(row, 'childNoBed'), 70)
  assert.equal(getPublicPerPaxUnitKrw(row, 'infant'), 10)
  const q = computeKRWQuotationPublic(row, { adult: 1, childBed: 1, childNoBed: 0, infant: 1 })
  assert.equal(q.total, 100 + 80 + 10)
}

// —— 가격: 출발일별 성인가가 다르면 본문 표로 아동·유아 일괄 덮어쓰지 않음 ——
{
  const rows: ProductPriceRow[] = [
    {
      id: 'a',
      productId: 'p',
      date: '2026-01-01',
      adult: 100,
      childBed: null,
      childNoBed: null,
      infant: null,
      localPrice: null,
      priceGap: 0,
      priceAdult: 100,
      priceChildWithBed: null,
      priceChildNoBed: null,
      priceInfant: null,
    },
    {
      id: 'b',
      productId: 'p',
      date: '2026-01-08',
      adult: 120,
      childBed: null,
      childNoBed: null,
      infant: null,
      localPrice: null,
      priceGap: 0,
      priceAdult: 120,
      priceChildWithBed: null,
      priceChildNoBed: null,
      priceInfant: null,
    },
  ]
  const out = mergeProductPriceRowsWithBodyPriceTable(rows, {
    adultPrice: 999,
    childExtraBedPrice: 80,
    childNoBedPrice: 70,
    infantPrice: 10,
  })
  assert.equal(out[0]!.adult, 100, '성인가는 출발일별 상이하면 본문으로 덮지 않음')
  assert.equal(out[1]!.adult, 120, '성인가 유지')
  assert.equal(out[0]!.childBed, 80, '달력 아동 슬롯이 전부 비면 성인가가 달라도 본문 아동가 채움')
  assert.equal(out[1]!.childBed, 80)
  assert.equal(out[0]!.infant, 10)
  assert.equal(out[1]!.infant, 10)
}

// —— 가격: 성인가 상이 + 일부 행에만 아동가 있으면 본문으로 아동 일괄 덮어쓰지 않음 ——
{
  const rows: ProductPriceRow[] = [
    {
      id: 'a',
      productId: 'p',
      date: '2026-01-01',
      adult: 100,
      childBed: null,
      childNoBed: null,
      infant: null,
      localPrice: null,
      priceGap: 0,
      priceAdult: 100,
      priceChildWithBed: null,
      priceChildNoBed: null,
      priceInfant: null,
    },
    {
      id: 'b',
      productId: 'p',
      date: '2026-01-08',
      adult: 120,
      childBed: 55,
      childNoBed: null,
      infant: null,
      localPrice: null,
      priceGap: 0,
      priceAdult: 120,
      priceChildWithBed: 55,
      priceChildNoBed: null,
      priceInfant: null,
    },
  ]
  const out = mergeProductPriceRowsWithBodyPriceTable(rows, {
    adultPrice: 999,
    childExtraBedPrice: 80,
    childNoBedPrice: 70,
    infantPrice: 10,
  })
  assert.equal(out[0]!.childBed, null)
  assert.equal(out[1]!.childBed, 55)
}

// —— 가격: 등록 prices[] → DepartureInput — child*Base 누락 시 출발일별 adultBase와 동행(confirm ProductPrice와 동일) ——
{
  const ins = parsedPricesToDepartureInputs([
    { date: '2026-03-01', adultBase: 1_000_000, adultFuel: 0, childFuel: 0 },
    { date: '2026-03-10', adultBase: 1_100_000, adultFuel: 0, childFuel: 0 },
    { date: '2026-03-20', adultBase: 1_000_000, adultFuel: 0, childBedBase: 800_000, childFuel: 0 },
  ])
  assert.equal(ins[0]!.childBedPrice, 1_000_000)
  assert.equal(ins[1]!.childBedPrice, 1_100_000)
  assert.equal(ins[2]!.childBedPrice, 800_000)
}

// —— 가격: 성인가 전 출발 동일이면 본문 표로 아동·유아 채움 유지 ——
{
  const rows: ProductPriceRow[] = [
    {
      id: 'a',
      productId: 'p',
      date: '2026-01-01',
      adult: 100,
      childBed: null,
      childNoBed: null,
      infant: null,
      localPrice: null,
      priceGap: 0,
      priceAdult: 100,
      priceChildWithBed: null,
      priceChildNoBed: null,
      priceInfant: null,
    },
    {
      id: 'b',
      productId: 'p',
      date: '2026-01-08',
      adult: 100,
      childBed: null,
      childNoBed: null,
      infant: null,
      localPrice: null,
      priceGap: 0,
      priceAdult: 100,
      priceChildWithBed: null,
      priceChildNoBed: null,
      priceInfant: null,
    },
  ]
  const out = mergeProductPriceRowsWithBodyPriceTable(rows, {
    adultPrice: 999,
    childExtraBedPrice: 80,
    childNoBedPrice: 70,
    infantPrice: 10,
  })
  assert.equal(out[0]!.childBed, 80)
  assert.equal(out[1]!.childBed, 80)
  assert.equal(out[0]!.infant, 10)
}

// —— 항공: 관리자 미확정+핵심 필드 비어 있으면 legacy 파싱 노출(공백 방지) ——
{
  assert.equal(resolveFlightDisplayPolicy(null), 'legacy_parsed')
  assert.equal(resolveFlightDisplayPolicy({ isFlightInfoConfirmed: false }), 'legacy_parsed')
  assert.equal(resolveFlightDisplayPolicy({ isFlightInfoConfirmed: true }), 'admin_only')
  assert.equal(
    resolveFlightDisplayPolicy({ isFlightInfoConfirmed: false, outboundFlightNo: 'KE1' }),
    'admin_only'
  )
}

// —— 항공: 모두투어 본문 — 편명 생략·화살표 변형 ——
{
  const lines = [
    '항공사: 테스트항공',
    '출발 : 인천 2026-07-07(화) 19:20 > 연길 2026-07-07(화) 20:40',
    '도착 : 연길 2026-07-10(금) 10:10 → 인천 2026-07-10(금) 13:25',
  ]
  const { result, trace } = tryParseModetourFlightLines(lines, lines.join('\n'))
  assert.equal(result.ok, true, '편명 없이 결정적 파싱 성공')
  assert.equal(trace.deterministicParserSucceeded, true)
}

// —— 항공: 실본문 — 일정 줄의 "출발: 08:00"보다 항공 스케줄 줄을 택함 ——
{
  const lines = [
    '1일차 현지 출발: 08:00 관광',
    '중국남방항공',
    '출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074',
    '도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073',
  ].map((l) => l.replace(/\s+/g, ' ').trim())
  const { result, trace } = tryParseModetourFlightLines(lines, lines.join('\n'))
  assert.equal(result.ok, true)
  assert.equal(trace.deterministicParserSucceeded, true)
  if (result.ok) {
    assert.equal(result.airlineName, '중국남방항공')
    assert.equal(result.outbound.flightNo, 'CZ6074')
    assert.equal(result.inbound.flightNo, 'CZ6073')
  }
}

// —— 가격: 실본문 — 상품가격·목록 접두(-) 4슬롯 ——
{
  const blob = `상품가격
- 성인 918,900원
- 아동 Extra Bed 918,900원
- 아동 No Bed 918,900원
- 유아 71,000원`
  const t = extractProductPriceTableByLabels(blob)
  assert.ok(t)
  assert.equal(t!.adultPrice, 918_900)
  assert.equal(t!.childExtraBedPrice, 918_900)
  assert.equal(t!.childNoBedPrice, 918_900)
  assert.equal(t!.infantPrice, 71_000)
}

// —— 쇼핑: 섹션 헤더 줄만 있는 경우 행으로 취급하지 않음 ——
{
  const s = parseUnstructuredShoppingBodyForRegister('쇼핑 정보\n쇼핑품목: 기념품 | 쇼핑장소: 매장')
  assert.ok(s.rows.length >= 1, '실데이터 행은 남음')
  assert.ok(
    s.rows.every((r) => !/^쇼핑\s*정보\s*$/i.test(r.shoppingItem.replace(/\s+/g, ' ').trim())),
    '머리말 "쇼핑 정보" 단독 행 제외'
  )
}

console.log('verify-register-detail-final-chain: OK')
