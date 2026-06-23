/**
 * ATP207260601TWJ 발췌본 — 항공·가격·쇼핑 시그널 결정론 검증 (Gemini 호출 없음).
 * npx tsx scripts/verify-hanatour-fixture-atp207.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { parseHanatourFlightInput } from '../lib/register-input-parse-hanatour'
import { resolveDirectedFlightLinesHanatour } from '../lib/register-flight-hanatour'
import { extractProductPriceTableByLabels } from '../lib/product-price-table-extract'
import { extractStructuredTourSignals } from '../lib/structured-tour-signals-hanatour'
import { parseHanatourShoppingInput } from '../lib/register-input-parse-hanatour'
import { formatFlightLegTwoLines } from '../lib/flight-user-display'
import { resolveShoppingConsumption } from '../lib/public-consumption-hanatour'
import {
  HANATOUR_ATP207_FLIGHT_PASTE,
  HANATOUR_ATP207_HEADER_SNIPPET,
  HANATOUR_ATP207_ORIGIN_CODE,
  HANATOUR_ATP207_PRICE_PASTE,
  HANATOUR_ATP207_SHOPPING_TABLE_PASTE,
} from './fixtures/hanatour-atp207260601twj.fixture'

const root = process.cwd()

function main() {
  const apiParseSrc = fs.readFileSync(path.join(root, 'lib/hanatour-register-api-parse.ts'), 'utf8')
  assert.ok(apiParseSrc.includes('collectHanatourRegisterFacts'), 'api-parse uses register-facts')
  assert.ok(!apiParseSrc.includes('parseForRegisterLlmHanatour'), 'api-parse must not use LLM overlay')
  assert.ok(
    !fs.existsSync(path.join(root, 'lib/register-from-llm-hanatour.ts')),
    'register-from-llm-hanatour removed',
  )

  const flight = parseHanatourFlightInput(HANATOUR_ATP207_FLIGHT_PASTE, HANATOUR_ATP207_FLIGHT_PASTE)
  assert.equal(flight.outbound.flightNo, 'TW0669')
  assert.equal(flight.inbound.flightNo, 'TW0670')
  assert.ok(flight.outbound.departureDate?.includes('2026-06-01'), 'outbound date')

  const directed = resolveDirectedFlightLinesHanatour({
    flightStructured: flight,
    sections: [],
    raw: { flightRaw: HANATOUR_ATP207_FLIGHT_PASTE },
    normalizedRaw: HANATOUR_ATP207_FLIGHT_PASTE,
  } as Parameters<typeof resolveDirectedFlightLinesHanatour>[0])
  assert.ok(directed.departureSegmentFromStructured?.includes('TW0669'), 'directed departure')
  assert.ok(directed.returnSegmentFromStructured?.includes('TW0670'), 'directed return')

  const px = extractProductPriceTableByLabels(HANATOUR_ATP207_PRICE_PASTE)
  assert.ok(px)
  assert.equal(px!.adultPrice, 819_900)
  assert.equal(px!.infantPrice, 150_000)

  const signals = extractStructuredTourSignals(HANATOUR_ATP207_HEADER_SNIPPET)
  assert.equal(signals.hasShopping, false, 'header 쇼핑없음 — 시그널 regex는 표 행 없으면 hasShopping false')
  assert.ok(
    signals.shoppingVisitCount == null || signals.shoppingVisitCount === 0,
    'visit count from header chip (LLM P1b가 쇼핑없음→0 구조화)',
  )

  const shop = parseHanatourShoppingInput(HANATOUR_ATP207_SHOPPING_TABLE_PASTE, HANATOUR_ATP207_SHOPPING_TABLE_PASTE)
  assert.equal(shop.rows.length, 3, 'shopping table rows (visit count SSOT is not row count for hanatour LLM path)')

  const pubShop = resolveShoppingConsumption({
    canonical: null,
    legacyDbRows: [],
    legacyMetaRows: [],
    shoppingPasteRaw: HANATOUR_ATP207_SHOPPING_TABLE_PASTE,
  })
  assert.equal(pubShop.value.length, 3, 'public paste fallback rows')
  assert.ok(pubShop.value[0]!.city === '타이베이' && pubShop.value[0]!.shopName?.includes('모공주'))

  const obLeg = {
    departureAirport: flight.outbound.departureAirport,
    arrivalAirport: flight.outbound.arrivalAirport,
    departureAtText: `${flight.outbound.departureDate} ${flight.outbound.departureTime}`,
    arrivalAtText: `${flight.outbound.arrivalDate} ${flight.outbound.arrivalTime}`,
    flightNo: flight.outbound.flightNo,
  }
  const heroOb = formatFlightLegTwoLines(obLeg)
  assert.ok(heroOb, 'hero two-line flight without airports')
  assert.ok(heroOb!.departureAtText.includes('(월)'), 'weekday on outbound hero')

  console.log('[ok] hanatour fixture', HANATOUR_ATP207_ORIGIN_CODE)
  console.log('  flight:', flight.outbound.flightNo, '→', flight.inbound.flightNo)
  console.log('  price adult:', px!.adultPrice)
  console.log('  header shopping visits:', signals.shoppingVisitCount)
  console.log('  shopping table rows:', shop.rows.length)
}

main()
