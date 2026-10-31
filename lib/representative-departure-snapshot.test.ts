import { describe, expect, it } from 'vitest'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcYbtour } from '@/lib/flight-manual-correction-ybtour'
import { normalizeDepartureKeyFactsForPayload } from '@/lib/product-public-detail/normalize-departure-key-facts-for-payload'
import {
  carrierLabelsEquivalent,
  kstTodayYmdForRepresentative,
  pickNearestOnSaleDepartureOnOrAfter,
  planRepresentativeRecollect,
  resolveRepresentativeFlightSnapshot,
  snapshotAppliesToDeparture,
  ymdFromEvCdShapedOriginCode,
} from '@/lib/representative-departure-snapshot'

/** pkg-yb-0034 실데이터 구조(값은 공급사 공개 편명·일자만) */
const yb0034Signals = {
  flightStructured: {
    airlineName: '에미레이트항공',
    outbound: { flightNo: 'EK323', departureDate: '2026-09-02 (수)' },
    inbound: { flightNo: 'EK322', departureDate: '2026-09-10 (목)' },
  },
  flightManualCorrection: {
    outbound: { auto: { airline: '에미레이트항공', flightNo: 'EK323', departureDate: '2026-09-02 (수)' } },
    inbound: { auto: { airline: '에미레이트항공', flightNo: 'EK322', departureDate: '2026-09-10 (목)' } },
  },
}

describe('REGRESSION-FREEZE[rep-departure-future-1031] 대표 출발 스냅샷', () => {
  const snap = resolveRepresentativeFlightSnapshot({
    structuredSignals: yb0034Signals,
    originCode: 'FEP1009-260902EK00',
  })

  it('스냅샷 = 수집 회차 일자·항공사·편명', () => {
    expect(snap).toMatchObject({
      ymd: '2026-09-02',
      ymdSource: 'fmc.auto',
      airline: '에미레이트항공',
      outboundFlightNo: 'EK323',
      inboundFlightNo: 'EK322',
      hasManualFinal: false,
    })
    expect(ymdFromEvCdShapedOriginCode('FEP1009-261119TK00')).toBe('2026-11-19')
    expect(ymdFromEvCdShapedOriginCode('2JZZ8258')).toBeNull()
  })

  it('항공사 다른 다른 회차(터키항공)에는 스냅샷 미적용, 같은 회차/같은 항공사는 적용', () => {
    expect(snapshotAppliesToDeparture(snap, { ymd: '2026-11-19', carrierName: '터키항공' })).toBe(false)
    expect(snapshotAppliesToDeparture(snap, { ymd: '2026-09-02', carrierName: '터키항공' })).toBe(true)
    expect(snapshotAppliesToDeparture(snap, { ymd: '2026-11-19', carrierName: '에미레이트항공' })).toBe(true)
    // 회차 편명 계열 우선
    expect(snapshotAppliesToDeparture(snap, { ymd: '2026-11-19', carrierName: '에미레이트항공', outboundFlightNo: 'TK91' })).toBe(false)
    expect(snapshotAppliesToDeparture(snap, { ymd: '2026-11-19', carrierName: null, outboundFlightNo: 'EK323' })).toBe(true)
    // 판단 불가 → 기존 동작
    expect(snapshotAppliesToDeparture(snap, { ymd: '2026-11-19', carrierName: null })).toBe(true)
  })

  it('티웨이→트리니티 상호 변경은 동일 항공사', () => {
    expect(carrierLabelsEquivalent('티웨이항공', '트리니티항공(구)티웨이항공')).toBe(true)
    const tw = resolveRepresentativeFlightSnapshot({
      structuredSignals: { flightStructured: { airlineName: '티웨이항공', outbound: { flightNo: 'TW0281', departureDate: '2026-10-01' } } },
    })
    expect(snapshotAppliesToDeparture(tw, { ymd: '2026-11-09', carrierName: '트리니티항공(구)티웨이항공' })).toBe(true)
  })

  it('관리자 final 있으면 회차 불일치여도 유지', () => {
    const fin = resolveRepresentativeFlightSnapshot({
      structuredSignals: {
        ...yb0034Signals,
        flightManualCorrection: { ...yb0034Signals.flightManualCorrection, outbound: { ...yb0034Signals.flightManualCorrection.outbound, final: { flightNo: 'EK323' } } },
      },
    })
    expect(fin.hasManualFinal).toBe(true)
    expect(snapshotAppliesToDeparture(fin, { ymd: '2026-11-19', carrierName: '터키항공' })).toBe(true)
  })

  it('제외 회차 신호는 payload 정규화에서 보존, 미제외는 키 없음', () => {
    const base: DepartureKeyFacts = {
      airline: '터키항공', outbound: null, inbound: null, outboundSummary: null, inboundSummary: null, meetingSummary: null,
    }
    expect(normalizeDepartureKeyFactsForPayload({ ...base, flightSnapshotExcluded: true }).flightSnapshotExcluded).toBe(true)
    expect('flightSnapshotExcluded' in normalizeDepartureKeyFactsForPayload(base)).toBe(false)
  })

  it('overlay 생략 시 회차 항공사(터키항공) 유지 — 기존 overlay 는 에미레이트로 덮던 동작', () => {
    const row: DepartureKeyFacts = {
      airline: '터키항공', outbound: null, inbound: null, outboundSummary: null, inboundSummary: null, meetingSummary: null,
      flightSnapshotExcluded: true,
    }
    const overlaid = applyFmcYbtour(row, yb0034Signals.flightManualCorrection)
    expect(overlaid?.airline).toBe('에미레이트항공')
    const shown = row.flightSnapshotExcluded ? row : overlaid
    expect(shown?.airline).toBe('터키항공')
    expect(shown?.outbound?.flightNo ?? null).toBeNull()
  })

  it('재수집 훅: 지난 스냅샷 → 오늘 이후 가장 가까운 판매 중 출발(마감·비예약 제외)', () => {
    const deps = [
      { ymd: '2026-10-29', code: 'ybtour:FEP1009-261029TK00' },
      { ymd: '2026-11-12', code: 'ybtour:FEP1009-261112TK00', statusRaw: '마감' },
      { ymd: '2026-11-19', code: 'ybtour:FEP1009-261119TK00', statusRaw: '예약가능' },
      { ymd: '2026-11-26', code: 'ybtour:FEP1009-261126TK00' },
    ]
    expect(pickNearestOnSaleDepartureOnOrAfter(deps, '2026-10-31')?.code).toBe('ybtour:FEP1009-261119TK00')
    const plan = planRepresentativeRecollect({ snapshot: snap, departures: deps, todayYmd: '2026-10-31' })
    expect(plan).toMatchObject({ needed: true, reason: 'snapshot_past', snapshotYmd: '2026-09-02' })
    expect(plan.target?.ymd).toBe('2026-11-19')
    // 롤오버: 11-19 지나면 다음 회차
    expect(planRepresentativeRecollect({ snapshot: snap, departures: deps, todayYmd: '2026-11-20' }).target?.ymd).toBe('2026-11-26')
    expect(planRepresentativeRecollect({ snapshot: { ...snap, ymd: '2026-11-19' }, departures: deps, todayYmd: '2026-10-31' }).needed).toBe(false)
    expect(planRepresentativeRecollect({ snapshot: snap, departures: [], todayYmd: '2026-10-31' }).reason).toBe('no_future_on_sale')
    expect(planRepresentativeRecollect({ snapshot: { ...snap, ymd: null }, departures: deps, todayYmd: '2026-10-31' }).reason).toBe('snapshot_unknown')
  })

  it('KST 오늘', () => {
    expect(kstTodayYmdForRepresentative(new Date('2026-10-30T15:30:00Z'))).toBe('2026-10-31')
  })
})
