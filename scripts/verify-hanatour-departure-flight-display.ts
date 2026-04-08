/**
 * 하나투어 출발확정 근거·항공 성격(경유/직항) 결정적 규칙.
 * 실행: npx tsx scripts/verify-hanatour-departure-flight-display.ts
 */
import assert from 'node:assert/strict'
import {
  formatHanatourDepartureConditionForProduct,
  hanatourExplicitDepartureGuaranteedInHaystack,
} from '../lib/hanatour-departure-flight-display'
import { inferHanatourFlightRoutingMeta } from '../lib/hanatour-flight-routing-meta'

function main() {
  assert.equal(
    hanatourExplicitDepartureGuaranteedInHaystack('예약현황 예약 : 0명 좌석 : 4석 (최소출발 : 성인15명)'),
    false,
    '숫자만으로 출발확정 아님'
  )
  assert.equal(hanatourExplicitDepartureGuaranteedInHaystack('[출발확정] ★특가'), true)
  assert.equal(
    hanatourExplicitDepartureGuaranteedInHaystack('행사 확정 후 안내드립니다'),
    false,
    '행사 확정 문구만으로 출발확정 아님'
  )

  const noCueLine = formatHanatourDepartureConditionForProduct({
    departureStatusText: '출발확정 · 최소출발 15명 · 현재예약 0명',
    minimumDepartureCount: 15,
    currentBookedCount: 0,
    title: '제목만',
    duration: '3박 4일',
  })
  assert.ok(!String(noCueLine).includes('출발확정'), String(noCueLine))

  const withCueLine = formatHanatourDepartureConditionForProduct({
    departureStatusText: '출발확정 · 최소출발 10명',
    minimumDepartureCount: 10,
    title: '본문 [출발확정] 패키지',
  })
  assert.ok(String(withCueLine).includes('출발확정'), String(withCueLine))

  const routing = inferHanatourFlightRoutingMeta({
    title: '어떤 상품',
    duration: '9박 12일 외국항공 경유있음 쇼핑없음 단체여행',
    includedText: null,
    excludedText: null,
    flightStructured: null,
    departureKeyFactsByDate: null,
  })
  assert.equal(routing.flightRoutingLabel, '경유 있음')

  const routingDirect = inferHanatourFlightRoutingMeta({
    title: '직항 규슈',
    duration: '3박 4일',
    includedText: null,
    excludedText: null,
    flightStructured: null,
    departureKeyFactsByDate: null,
  })
  assert.equal(routingDirect.flightRoutingLabel, '직항')

  console.log('OK: verify-hanatour-departure-flight-display')
}

main()
