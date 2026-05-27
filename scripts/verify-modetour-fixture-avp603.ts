/**
 * AVP603TWA1 발췌본 — 항공·가격·헤더 시그널 결정론 검증 (Gemini 호출 없음).
 * npx tsx scripts/verify-modetour-fixture-avp603.ts
 */
import assert from 'node:assert/strict'
import { parseModetourFlightInput } from '../lib/register-input-parse-modetour'
import { buildModetourDirectedSegmentLinesFromFlightRaw } from '../lib/flight-modetour-parser'
import { extractProductPriceTableByLabels } from '../lib/product-price-table-extract'
import { extractStructuredTourSignals } from '../lib/structured-tour-signals-modetour'
import { applyModetourScheduleImageKeywordsToRows } from '../lib/modetour-schedule-image-keyword'
import {
  MODETOUR_AVP603_FLIGHT_PASTE,
  MODETOUR_AVP603_HEADER_SNIPPET,
  MODETOUR_AVP603_ORIGIN_CODE,
  MODETOUR_AVP603_PRICE_PASTE,
} from './fixtures/modetour-avp603twa1.fixture'

function main() {
  const directed = buildModetourDirectedSegmentLinesFromFlightRaw(MODETOUR_AVP603_FLIGHT_PASTE)
  assert.ok(directed?.departureLine?.includes('TW013'), 'departure TW013')
  assert.ok(directed?.returnLine?.includes('TW014'), 'return TW014')
  assert.ok(directed?.departureLine?.includes('다낭'), 'departure danang')

  const flight = parseModetourFlightInput(MODETOUR_AVP603_FLIGHT_PASTE, null)
  assert.equal(flight.outbound.flightNo, 'TW013')
  assert.equal(flight.inbound.flightNo, 'TW014')
  assert.equal(flight.debug?.modetourParseTrace?.deterministicParserSucceeded, true)

  const px = extractProductPriceTableByLabels(MODETOUR_AVP603_PRICE_PASTE)
  assert.ok(px)
  assert.equal(px!.adultPrice, 549_000)
  assert.equal(px!.childExtraBedPrice, 539_000)
  assert.equal(px!.childNoBedPrice, 529_000)
  assert.equal(px!.infantPrice, 150_000)

  const signals = extractStructuredTourSignals(MODETOUR_AVP603_HEADER_SNIPPET)
  assert.equal(signals.shoppingVisitCount, 3)
  assert.equal(signals.hasShopping, true)
  // 헤더 「선택관광 있음」은 표 행이 아니면 hasOptionalTour=false — 전용 옵션 붙여넣기 SSOT
  assert.match(MODETOUR_AVP603_HEADER_SNIPPET, /선택관광[\s\S]*?있음/)

  console.log('[ok] modetour fixture', MODETOUR_AVP603_ORIGIN_CODE)
  console.log('  flight:', directed?.departureLine?.slice(0, 72), '…')
  console.log('  price adult:', px!.adultPrice)
  console.log('  shopping visits:', signals.shoppingVisitCount)

  const avp603ScheduleRows = [
    { day: 1, title: '인천', description: '인천 (ICN) 출발 21:35 → 다낭 도착', routeText: 'Incheon - Da Nang' },
    { day: 2, title: '다낭 → 호이안', description: '마블 마운틴 호이안 야경', routeText: 'Da Nang - Hoi An' },
    { day: 3, title: '다낭', description: '바나힐 테마파크', routeText: 'Da Nang - Ba Na Hills', imageKeyword: 'Ba Na Hills' },
    { day: 4, title: '다낭', description: '영흥사 미케비치', routeText: 'Da Nang - My Khe Beach', imageKeyword: 'My Khe Beach' },
    { day: 5, title: '인천', description: '다낭 출발 인천 국제공항 도착', routeText: 'Da Nang - Incheon' },
  ]
  const dest = '다낭, 호이안'
  const kwApplied = applyModetourScheduleImageKeywordsToRows(
    avp603ScheduleRows.map((r) => ({
      day: r.day,
      title: r.title,
      description: r.description,
      routeText: r.routeText ?? null,
      imageKeyword: (r as { imageKeyword?: string }).imageKeyword ?? 'Da Nang',
      imageKeyword2: null,
    })),
    { productDestination: dest },
  )
  const kwDay1 = kwApplied.find((r) => r.day === 1)!.imageKeyword
  const kwDay5 = kwApplied.find((r) => r.day === 5)!.imageKeyword
  assert.match(kwDay1, /Da Nang/i, 'day1 movement → overseas city from routeText')
  assert.ok(!/airport/i.test(kwDay1), 'day1 no airport keyword')
  assert.match(kwDay5, /Da Nang/i, 'day5 return → overseas city from routeText')
  assert.ok(!/airport/i.test(kwDay5), 'day5 no airport keyword')

  const kwDay2Applied = applyModetourScheduleImageKeywordsToRows(
    [
      {
        day: 2,
        title: '호이안 야경투어',
        description: '투본강',
        routeText: 'Da Nang - Hoi An',
        imageKeyword: 'Hoi An',
        imageKeyword2: null,
      },
    ],
    { productDestination: dest },
  )
  const kwHoiAn = kwDay2Applied[0]!.imageKeyword
  assert.match(kwHoiAn, /Hoi An/i, 'day2 hoian LLM keyword')
  const kwBanahill = kwApplied.find((r) => r.day === 3)!.imageKeyword
  assert.match(kwBanahill, /Ba Na|My Khe|Da Nang/i, 'day3 keyword from LLM or route')
  console.log('  imageKeyword day1/5:', kwDay1, '|', kwDay5)
  console.log('  imageKeyword spots:', kwBanahill, '|', kwHoiAn)
}

main()
