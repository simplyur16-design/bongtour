/**
 * 하나투어 전용 항공 수동 보정(flightManualCorrection) 회귀 검증.
 * 실행: npx tsx scripts/verify-manual-flight-hanatour.ts
 *
 * 검증: mergeFlightManualCorrectionOnReparse, applyFlightManualCorrectionToDepartureKeyFacts,
 *       rawMeta 저장/복원(getFlightManualCorrectionFromRawMeta + mergeFlightManualCorrectionIntoRawMeta)
 */
import assert from 'node:assert/strict'
import type { DepartureKeyFacts } from '../lib/departure-key-facts'
import {
  applyFlightManualCorrectionToDepartureKeyFacts,
  mergeFlightManualCorrectionOnReparse,
  type FlightManualCorrectionPayload,
  getFlightManualCorrectionFromRawMeta,
} from '../lib/flight-manual-correction-hanatour'
import { mergeFlightManualCorrectionIntoRawMeta } from '../lib/raw-meta-admin-flight'

function baseFacts(): DepartureKeyFacts {
  return {
    airline: '테스트항공',
    outbound: {
      departureAirport: 'ICN',
      arrivalAirport: 'NRT',
      departureAtText: '2025.03.01(토) 08:30',
      arrivalAtText: '2025.03.01(토) 11:00',
      flightNo: 'KE123',
    },
    inbound: {
      departureAirport: 'NRT',
      arrivalAirport: 'ICN',
      departureAtText: '2025.03.08(토) 19:20',
      arrivalAtText: '2025.03.08(토) 22:30',
      flightNo: 'KE456',
    },
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }
}

// —— 케이스 A: 편명만 final —— auto/merge 문자열과 섞지 않음 ——
{
  const facts = baseFacts()
  const correction: FlightManualCorrectionPayload = {
    outbound: {
      final: { flightNo: 'KE999' },
    },
  }
  const out = applyFlightManualCorrectionToDepartureKeyFacts(facts, correction)!
  assert.equal(out.outbound?.flightNo, 'KE999', 'A: outbound 편명만 final')
  assert.equal(out.outbound?.departureAirport, null, 'A: auto 공항 미사용')
  assert.equal(out.outbound?.departureAtText, null, 'A: auto 일시 미사용')
  assert.equal(out.inbound?.flightNo, facts.inbound?.flightNo, 'A: 오는편 미변경')
}

// —— 케이스 B: 시간만 final (가는편) ——
{
  const facts = baseFacts()
  const correction: FlightManualCorrectionPayload = {
    outbound: {
      final: { departureTime: '09:15', arrivalTime: '12:45' },
    },
  }
  const out = applyFlightManualCorrectionToDepartureKeyFacts(facts, correction)!
  assert.equal(out.outbound?.flightNo, null, 'B: 편명 미입력 시 null')
  assert.equal(out.outbound?.departureAtText, '09:15', 'B: 출발 시각만')
  assert.equal(out.outbound?.arrivalAtText, '12:45', 'B: 도착 시각만')
}

// —— 케이스 C: 가는편 편명만 + 오는편 시간만 —— 각각 final-only 조합 ——
{
  const facts = baseFacts()
  const correction: FlightManualCorrectionPayload = {
    outbound: {
      final: { flightNo: 'OB_ONLY' },
    },
    inbound: {
      final: { departureTime: '20:00', arrivalTime: '23:10' },
    },
  }
  const out = applyFlightManualCorrectionToDepartureKeyFacts(facts, correction)!
  assert.equal(out.outbound?.flightNo, 'OB_ONLY', 'C: outbound 편명')
  assert.equal(out.outbound?.departureAtText, null, 'C: outbound 시간 없음')
  assert.equal(out.inbound?.flightNo, null, 'C: inbound 편명 미입력')
  assert.equal(out.inbound?.departureAtText, '20:00', 'C: inbound 출발 시각')
  assert.equal(out.inbound?.arrivalAtText, '23:10', 'C: inbound 도착 시각')
}

// —— 케이스 D: 재파싱 보호 —— auto 갱신, final·reviewState·rawSnippet 유지 ——
{
  const prev: FlightManualCorrectionPayload = {
    outbound: {
      auto: { flightNo: 'OLD_O', departureTime: '08:00', arrivalTime: '10:00' },
      final: { flightNo: 'FINAL_O', departureTime: null, arrivalTime: null },
      reviewState: 'manually_edited',
      rawSnippet: 'out-raw',
    },
    inbound: {
      auto: { flightNo: 'OLD_I', departureTime: '19:00', arrivalTime: '22:00' },
      final: { flightNo: null, departureTime: '19:30', arrivalTime: null },
      reviewState: 'approved',
    },
  }
  const nextAuto = {
    outbound: { flightNo: 'NEW_AUTO_O', departureTime: '09:00', arrivalTime: '11:00' },
    inbound: { flightNo: 'NEW_AUTO_I', departureTime: '20:00', arrivalTime: '23:00' },
  }
  const merged = mergeFlightManualCorrectionOnReparse(prev, nextAuto)!
  assert.equal(merged.outbound?.auto?.flightNo, 'NEW_AUTO_O', 'D: outbound auto 최신')
  assert.equal(merged.outbound?.auto?.departureTime, '09:00', 'D: outbound auto 시간 갱신')
  assert.equal(merged.outbound?.final?.flightNo, 'FINAL_O', 'D: outbound final 유지')
  assert.equal(merged.outbound?.reviewState, 'manually_edited', 'D: reviewState 유지')
  assert.equal(merged.outbound?.rawSnippet, 'out-raw', 'D: rawSnippet 유지')
  assert.equal(merged.inbound?.auto?.flightNo, 'NEW_AUTO_I', 'D: inbound auto 최신')
  assert.equal(merged.inbound?.final?.departureTime, '19:30', 'D: inbound final 시간 유지')
  assert.equal(merged.inbound?.reviewState, 'approved', 'D: inbound reviewState 유지')
}

// —— 케이스 E: final 비어 있음 / correction 없음 —— 기존 facts 유지 ——
{
  const facts = baseFacts()
  assert.equal(applyFlightManualCorrectionToDepartureKeyFacts(facts, null), facts, 'E: correction null')
  assert.equal(applyFlightManualCorrectionToDepartureKeyFacts(facts, undefined), facts, 'E: correction undefined')
  const emptyCorrection: FlightManualCorrectionPayload = {}
  const e2 = applyFlightManualCorrectionToDepartureKeyFacts(facts, emptyCorrection)!
  assert.equal(e2.outbound?.flightNo, facts.outbound?.flightNo, 'E: 빈 payload 시 편명 유지')
}

// —— 저장 후 읽기 (structuredSignals.flightManualCorrection) ——
{
  const payload: FlightManualCorrectionPayload = {
    outbound: {
      auto: { flightNo: 'A1', departureTime: '08:00', arrivalTime: '10:00' },
      final: { flightNo: 'FINAL_SAVE', departureTime: '08:05', arrivalTime: null },
      reviewState: 'manually_edited',
    },
    inbound: {
      auto: { flightNo: 'B1', departureTime: '19:00', arrivalTime: '22:00' },
      final: { flightNo: null, departureTime: null, arrivalTime: '23:00' },
    },
  }
  const rawMeta = mergeFlightManualCorrectionIntoRawMeta(null, payload)
  assert.ok(rawMeta, 'rawMeta 생성')
  const read = getFlightManualCorrectionFromRawMeta(rawMeta)
  assert.equal(read?.outbound?.final?.flightNo, 'FINAL_SAVE', 'round-trip: outbound final 편명')
  assert.equal(read?.outbound?.final?.departureTime, '08:05', 'round-trip: outbound final 출발')
  assert.equal(read?.inbound?.final?.arrivalTime, '23:00', 'round-trip: inbound final 도착')
  assert.equal(read?.outbound?.reviewState, 'manually_edited', 'round-trip: reviewState')
}

// —— 기존 structuredSignals와 병합 시 다른 키 유지 ——
{
  const existing = JSON.stringify({
    structuredSignals: { hotelStructured: { rows: [] }, outboundFlightNo: 'X' },
  })
  const payload: FlightManualCorrectionPayload = {
    outbound: { final: { flightNo: 'MERGED', departureTime: null, arrivalTime: null } },
  }
  const next = mergeFlightManualCorrectionIntoRawMeta(existing, payload)!
  const o = JSON.parse(next) as { structuredSignals: Record<string, unknown> }
  assert.ok(Array.isArray((o.structuredSignals.hotelStructured as { rows: unknown }).rows), 'merge: hotelStructured 유지')
  assert.equal(o.structuredSignals.outboundFlightNo, 'X', 'merge: flat 필드 유지')
  assert.equal(
    (o.structuredSignals.flightManualCorrection as FlightManualCorrectionPayload).outbound?.final?.flightNo,
    'MERGED',
    'merge: flightManualCorrection 삽입'
  )
}

console.log('verify-manual-flight-hanatour: ok')
