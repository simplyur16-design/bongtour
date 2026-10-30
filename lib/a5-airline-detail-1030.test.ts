import { afterEach, describe, expect, it } from 'vitest'
import { computeReturnDate } from '@/lib/package-rules'
import {
  PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES,
  slimDepartureKeyFactsRecordForPayload,
  slimTravelProductDepartureFactsForPayload,
} from '@/lib/product-public-detail/slim-departure-key-facts-for-payload'
import {
  alignDepartureFactsToSelectedAirline,
  departureFactsMatchAirline,
  resolveSelectedDepartureAirlineForDisplay,
  sanitizeProductAirlineForDisplay,
} from '@/lib/detail-selected-departure-airline'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'

function facts(airline: string): DepartureKeyFacts {
  return {
    airline,
    outbound: null,
    inbound: null,
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }
}

describe('A-5 상세 — 상단/하단 항공사 같은 회차 facts', () => {
  it('선택 회차 항공사가 있으면 그것, 없을 때만 상품 대표 항공사(쓰레기 제거)', () => {
    expect(resolveSelectedDepartureAirlineForDisplay('제주항공', '대한항공')).toBe('제주항공')
    expect(resolveSelectedDepartureAirlineForDisplay(null, '대한항공')).toBe('대한항공')
    expect(resolveSelectedDepartureAirlineForDisplay('  ', '- [교통] 왕복항공권')).toBeNull()
    expect(sanitizeProductAirlineForDisplay('- [교통] 왕복항공권')).toBeNull()
  })

  it('payload 키팩트는 공개 가격행 회차를 모두 남김(앞 30건 cuid 컷 아님)', () => {
    const byId: Record<string, DepartureKeyFacts> = {}
    const prices: Array<{ id: string; date: string }> = []
    for (let i = 0; i < 120; i++) {
      const id = `c${String(i).padStart(3, '0')}`
      byId[id] = facts(i % 2 ? '대한항공' : '제주항공')
      if (i >= 60) prices.push({ id, date: `2026-12-${String((i % 28) + 1).padStart(2, '0')}` })
    }
    const slim = slimTravelProductDepartureFactsForPayload({
      prices,
      departureKeyFactsByDepartureId: byId,
      departureKeyFactsByDate: undefined,
    } as unknown as TravelProduct)
    const keys = Object.keys(slim.departureKeyFactsByDepartureId ?? {})
    expect(keys).toHaveLength(60)
    expect(keys).toContain('c119')
    expect(keys).not.toContain('c000')
  })

  it('가격행 키를 모르면 기존 30건 상한 그대로', () => {
    const byId: Record<string, DepartureKeyFacts> = {}
    for (let i = 0; i < 50; i++) byId[`k${i}`] = facts('대한항공')
    expect(Object.keys(slimDepartureKeyFactsRecordForPayload(byId) ?? {})).toHaveLength(
      PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES,
    )
    expect(
      Object.keys(slimDepartureKeyFactsRecordForPayload(byId, new Set(['zzz'])) ?? {}),
    ).toHaveLength(PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES)
  })
})

describe('A-5 귀국일 — 서버(UTC)에서도 하루 짧지 않음', () => {
  const orig = process.env.TZ
  afterEach(() => {
    process.env.TZ = orig
  })
  it('7박 9일 12/04 → 12/12, 2박 4일 11/28 → 12/01 (TZ=UTC·Asia/Seoul 동일)', () => {
    for (const tz of ['UTC', 'Asia/Seoul', 'America/Los_Angeles']) {
      process.env.TZ = tz
      expect(computeReturnDate('2026-12-04', 9)).toBe('2026-12-12')
      expect(computeReturnDate('2026-11-28', 4)).toBe('2026-12-01')
      expect(computeReturnDate('2026-12-30', 4)).toBe('2027-01-02')
    }
  })
})

describe('A-5 상세 — ?airline= 선택 시 상단·하단 항공사·편명 = 고른 항공사', () => {
  const leg = (flightNo: string) => ({
    departureAirport: 'ICN',
    departureAtText: null,
    arrivalAirport: 'HKG',
    arrivalAtText: null,
    flightNo,
  })
  const withLeg = (airline: string | null, flightNo: string): DepartureKeyFacts => ({
    ...facts(airline ?? ''),
    airline,
    outbound: leg(flightNo),
    outboundSummary: `${flightNo} 출발`,
  })
  const jeju = { label: '제주항공', param: '7C' }

  it('필터 없으면 facts 그대로(기존 동작)', () => {
    const f = withLeg('대한항공', 'KE0603')
    expect(alignDepartureFactsToSelectedAirline(f, null)).toBe(f)
  })

  it('같은 항공사 facts 는 그대로 — 이름 또는 편명 IATA 로 판단', () => {
    const f = withLeg('제주항공', '7C2101')
    expect(alignDepartureFactsToSelectedAirline(f, jeju)).toBe(f)
    expect(departureFactsMatchAirline(withLeg(null, '7C2101'), jeju)).toBe(true)
    expect(alignDepartureFactsToSelectedAirline(withLeg(null, '7C2101'), jeju)?.airline).toBe('제주항공')
    expect(departureFactsMatchAirline(withLeg('LOT폴란드 항공', 'LO0098'), { label: 'LOT폴란드항공', param: 'LOT폴란드항공' })).toBe(true)
  })

  it('다른 항공사 facts(날짜 폴백)면 항공사=고른 항공사, 편명·시각은 비움(다른 항공사 편명 노출 금지)', () => {
    const out = alignDepartureFactsToSelectedAirline(withLeg('대한항공', 'KE0603'), jeju)
    expect(out?.airline).toBe('제주항공')
    expect(out?.outbound).toBeNull()
    expect(out?.inbound).toBeNull()
    expect(out?.outboundSummary).toBeNull()
    expect(resolveSelectedDepartureAirlineForDisplay(out?.airline, '대한항공')).toBe('제주항공')
  })

  it('facts 없음 + 필터 → 고른 항공사만', () => {
    const out = alignDepartureFactsToSelectedAirline(null, jeju)
    expect(out?.airline).toBe('제주항공')
    expect(out?.outbound).toBeNull()
  })
})
