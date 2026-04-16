/**
 * 출발일 수집 UI 단계·상담 요약(고정 필드) 검증 — 가격 숫자 하드코딩 없음.
 * 실행: npx tsx tools/verify-departure-price-collect-ui.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS,
  departurePriceCollectUiCopy,
  resolveDeparturePriceCollectUiPhase,
} from '@/lib/departure-price-collect-ui'
import { buildCounselChannelSummary } from '@/lib/booking-counsel-contract'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(
    DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS >= 8_000 && DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS <= 15_000,
    `DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS must be 8s–15s, got ${DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS}`
  )

  assert(resolveDeparturePriceCollectUiPhase(false, false, false) === 'idle', 'idle')
  assert(resolveDeparturePriceCollectUiPhase(true, false, false) === 'collecting', 'collecting')
  assert(resolveDeparturePriceCollectUiPhase(true, true, false) === 'delayed_collecting', 'delayed')
  assert(resolveDeparturePriceCollectUiPhase(false, false, true) === 'pending_quote', 'pending_quote')
  assert(
    resolveDeparturePriceCollectUiPhase(true, true, true) === 'delayed_collecting',
    'collecting wins over pending_quote'
  )

  assert(departurePriceCollectUiCopy.overlayTitlePrimary.includes('가격'), 'copy title')
  assert(departurePriceCollectUiCopy.overlayDelayLine3.includes('전화'), 'copy delay line')

  const summary = buildCounselChannelSummary('[예약 상담]', {
    productId: '999',
    originCode: 'TEST-ORIG',
    listingProductNumber: 'LIST-1',
    productTitle: '테스트 상품',
    originSource: 'verygoodtour',
    selectedDepartureDate: '2026-06-01',
    selectedDepartureId: null,
    preferredDepartureDate: null,
    pax: { adult: 2, childBed: 0, childNoBed: 0, infant: 0 },
    bookingId: 42,
    pageUrl: 'https://example.com/p/999',
    customerMemo: null,
    advisoryLabel: '상담 필요',
    pricingMode: 'schedule_selected_pending_quote',
    isCollectingPrices: false,
    quotationKrwTotal: null,
    localFeePerPerson: null,
    localFeeCurrency: null,
  })
  assert(summary.includes('상품번호(시스템): 999'), 'system id in summary')
  assert(summary.includes('테스트 상품'), 'title in summary')
  assert(summary.includes('2026-06-01'), 'date in summary')
  assert(summary.includes('성인 2'), 'pax in summary')
  assert(summary.includes('접수번호: 42'), 'booking id in summary')

  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const onDemandClient = path.join(root, 'lib', 'departure-range-on-demand-client.ts')
  assert(fs.existsSync(onDemandClient), 'on-demand client wrapper file exists (공급사별 스크래퍼와 분리)')

  console.log('verify-departure-price-collect-ui: OK')
}

main()
