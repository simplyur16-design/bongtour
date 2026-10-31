import { describe, expect, it } from 'vitest'
import { resolveOvernightArrivalAtText, isEastOfDatelineLeg } from '@/lib/flight-overnight-arrival'
import { formatFlightLegTwoLines, departureKeyFactsToHeroSsotItineraryFlightDisplay } from '@/lib/flight-user-display'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '@/lib/departure-facts-calendar-align'
import { applyFlightManualCorrectionToDepartureKeyFacts as applyFmcHanatour } from '@/lib/flight-manual-correction-hanatour'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'

describe('resolveOvernightArrivalAtText (표시 전용 야간편 도착일)', () => {
  it('같은 날짜 + 도착 시각 < 출발 시각 → 다음날·올바른 요일', () => {
    expect(
      resolveOvernightArrivalAtText({
        departureAtText: '2027.02.10(수) 21:20',
        arrivalAtText: '2027.02.10(수) 00:30',
      })
    ).toEqual({ arrivalAtText: '2027.02.11(목) 00:30', rolledDays: 1 })
  })

  it('도착 날짜 없음(시각만) → 출발 다음날', () => {
    expect(
      resolveOvernightArrivalAtText({ departureAtText: '2027.02.28(일) 23:55', arrivalAtText: '13:25' }).arrivalAtText
    ).toBe('2027.03.01(월) 13:25')
  })

  it('ISO 하이픈 표기도 처리 · 월말/연말 넘김', () => {
    expect(
      resolveOvernightArrivalAtText({ departureAtText: '2026-12-31 (목) 22:10', arrivalAtText: '2026-12-31 (목) 03:45' })
        .arrivalAtText
    ).toBe('2027.01.01(금) 03:45')
  })

  it('도착 시각 >= 출발 시각이면 그대로', () => {
    expect(
      resolveOvernightArrivalAtText({ departureAtText: '2026.07.01(수) 09:20', arrivalAtText: '2026.07.01(수) 13:20' })
    ).toEqual({ arrivalAtText: '2026.07.01(수) 13:20', rolledDays: null })
  })

  it('도착 날짜가 이미 다른 날이면 원문 유지', () => {
    expect(
      resolveOvernightArrivalAtText({ departureAtText: '2027.02.10(수) 21:20', arrivalAtText: '2027.02.11(목) 00:30' })
        .arrivalAtText
    ).toBe('2027.02.11(목) 00:30')
  })

  it('날짜변경선 동쪽(하와이·미주) 구간은 같은 날 이른 도착이 정상이므로 그대로', () => {
    expect(
      resolveOvernightArrivalAtText({
        departureAtText: '2026.10.06(화) 21:05',
        arrivalAtText: '2026.10.06(화) 10:55',
        departureAirport: '인천',
        arrivalAirport: '호놀룰루',
      }).arrivalAtText
    ).toBe('2026.10.06(화) 10:55')
    expect(isEastOfDatelineLeg('인천 국제공항', '밴쿠버 국제공항')).toBe(true)
    expect(isEastOfDatelineLeg('프라하', '인천')).toBe(false)
  })

  it('본문 +N 이 붙어 있으면 그 일수만큼', () => {
    expect(
      resolveOvernightArrivalAtText({
        departureAtText: '2026.10.10(토) 19:30',
        arrivalAtText: '2026.10.10(토) 01:00',
        embeddedDayOffset: 1,
      }).arrivalAtText
    ).toBe('2026.10.11(일) 01:00')
  })
})

describe('formatFlightLegTwoLines — 상단 카드·항공편 섹션 (가는편·오는편)', () => {
  it('가는편: 같은 날짜 이른 도착 → 다음날 + 배지 1', () => {
    const r = formatFlightLegTwoLines({
      departureAirport: '인천',
      arrivalAirport: '구이양',
      departureAtText: '2027.02.10(수) 21:20',
      arrivalAtText: '2027.02.10(수) 00:30',
      flightNo: '9H8382',
    })
    expect(r?.arrivalAtText).toBe('2027.02.11(목) 00:30')
    expect(r?.arrivalDayOffset).toBe(1)
  })

  it('오는편: 유럽 출발 같은 날짜 이른 도착 → 다음날', () => {
    const r = formatFlightLegTwoLines({
      departureAirport: '프라하',
      arrivalAirport: '인천',
      departureAtText: '2026.10.23(금) 18:50',
      arrivalAtText: '2026.10.23(금) 13:10',
      flightNo: 'OZ546',
    })
    expect(r?.arrivalAtText).toBe('2026.10.24(토) 13:10')
    expect(r?.arrivalDayOffset).toBe(1)
  })

  it('본문 "+1" 꼬리 + 같은 날짜 → 날짜도 다음날로', () => {
    const r = formatFlightLegTwoLines({
      departureAirport: '인천',
      arrivalAirport: '괌',
      departureAtText: '2026.10.10(토) 19:30',
      arrivalAtText: '2026.10.10(토) 01:00 +1',
      flightNo: 'RS101',
    })
    expect(r?.arrivalAtText).toBe('2026.10.11(일) 01:00')
    expect(r?.arrivalDayOffset).toBe(1)
  })

  it('정상 당일 도착은 변화 없음(회귀)', () => {
    const r = formatFlightLegTwoLines({
      departureAirport: '인천',
      arrivalAirport: '연길',
      departureAtText: '2026.07.01(수) 09:20',
      arrivalAtText: '2026.07.01(수) 13:20',
      flightNo: 'CZ6074',
    })
    expect(r?.arrivalAtText).toBe('2026.07.01(수) 13:20')
    expect(r?.arrivalDayOffset ?? null).toBeNull()
  })
})

describe('alignDepartureKeyFactsToSelectedCalendarDate — 익일 도착 유지', () => {
  const base: DepartureKeyFacts = {
    airline: '장안항공',
    outbound: {
      departureAirport: '인천 국제공항',
      arrivalAirport: '구이양 룽둥바오 국제공항',
      departureAtText: '2027.03.03(수) 21:20',
      arrivalAtText: '2027.03.04(목) 00:30',
      flightNo: '9H8382',
    },
    inbound: {
      departureAirport: '구이양 룽둥바오 국제공항',
      arrivalAirport: '인천 국제공항',
      departureAtText: '2027.03.07(일) 14:50',
      arrivalAtText: '2027.03.07(일) 20:20',
      flightNo: '9H8381',
    },
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }

  it('선택 출발일로 옮겨도 가는편 도착은 다음날 (이전: 출발일로 강제)', () => {
    const r = alignDepartureKeyFactsToSelectedCalendarDate(base, '2027-02-10', { packageTotalDays: 5 })
    expect(r?.outbound?.departureAtText).toBe('2027.02.10(수) 21:20')
    expect(r?.outbound?.arrivalAtText).toBe('2027.02.11(목) 00:30')
    expect(r?.inbound?.departureAtText).toBe('2027.02.14(일) 14:50')
    expect(r?.inbound?.arrivalAtText).toBe('2027.02.14(일) 20:20')
  })

  it('원문 도착일이 출발일과 같고 이른 시각이면 다음날 (가는편·오는편)', () => {
    const f: DepartureKeyFacts = {
      ...base,
      outbound: { ...base.outbound!, arrivalAtText: '2027.03.03(수) 00:30' },
      inbound: {
        ...base.inbound!,
        departureAtText: '2027.03.07(일) 23:30',
        arrivalAtText: '2027.03.07(일) 04:50',
      },
    }
    const r = alignDepartureKeyFactsToSelectedCalendarDate(f, '2027-02-10', { packageTotalDays: 5 })
    expect(r?.outbound?.arrivalAtText).toBe('2027.02.11(목) 00:30')
    expect(r?.inbound?.arrivalAtText).toBe('2027.02.15(월) 04:50')
  })

  it('하와이 가는편 같은 날 도착은 그대로', () => {
    const f: DepartureKeyFacts = {
      ...base,
      outbound: {
        departureAirport: '인천',
        arrivalAirport: '호놀룰루',
        departureAtText: '2026.10.06(화) 21:05',
        arrivalAtText: '2026.10.06(화) 10:55',
        flightNo: 'KE053',
      },
      inbound: null,
    }
    const r = alignDepartureKeyFactsToSelectedCalendarDate(f, '2026-10-13', { packageTotalDays: 5 })
    expect(r?.outbound?.arrivalAtText).toBe('2026.10.13(화) 10:55')
  })
})

describe('fit-hn-0059 실데이터 체인 (8개 출발일)', () => {
  // DB 공개 payload departureKeyFactsByDate 행(공항 깨짐·시각 null) + flightManualCorrection.auto (공급사 원문 그대로)
  const row: DepartureKeyFacts = {
    airline: '장안항공',
    outbound: { departureAirport: '2027', departureAtText: null, arrivalAirport: '03', arrivalAtText: null, flightNo: '9H8382', flightDurationText: null },
    inbound: { departureAirport: '2027', departureAtText: null, arrivalAirport: '03', arrivalAtText: null, flightNo: '9H8381', flightDurationText: null },
    outboundSummary: '가는편: 9H8382',
    inboundSummary: null,
    meetingSummary: null,
  }
  const fmc = {
    outbound: {
      auto: { airline: '장안항공', departureAirport: '인천 국제공항', departureDate: '2027-03-03', departureTime: '21:20', arrivalAirport: '구이양 룽둥바오 국제공항', arrivalDate: '2027-03-04', arrivalTime: '00:30', flightNo: '9H8382' },
      final: null,
    },
    inbound: {
      auto: { airline: '장안항공', departureAirport: '구이양 룽둥바오 국제공항', departureDate: '2027-03-07', departureTime: '14:50', arrivalAirport: '인천 국제공항', arrivalDate: '2027-03-07', arrivalTime: '20:20', flightNo: '9H8381' },
      final: null,
    },
  }
  const dates: Array<[string, string, string]> = [
    ['2027-02-03', '2027.02.04(목) 00:30', '2027.02.07(일) 20:20'],
    ['2027-02-10', '2027.02.11(목) 00:30', '2027.02.14(일) 20:20'],
    ['2027-02-17', '2027.02.18(목) 00:30', '2027.02.21(일) 20:20'],
    ['2027-02-24', '2027.02.25(목) 00:30', '2027.02.28(일) 20:20'],
    ['2027-03-03', '2027.03.04(목) 00:30', '2027.03.07(일) 20:20'],
    ['2027-03-10', '2027.03.11(목) 00:30', '2027.03.14(일) 20:20'],
    ['2027-03-17', '2027.03.18(목) 00:30', '2027.03.21(일) 20:20'],
    ['2027-03-24', '2027.03.25(목) 00:30', '2027.03.28(일) 20:20'],
  ]
  for (const [d, obArr, ibArr] of dates) {
    it(`${d} 가는편 도착 = ${obArr}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const corrected = applyFmcHanatour(row, fmc as any)
      const aligned = alignDepartureKeyFactsToSelectedCalendarDate(corrected, d, { packageTotalDays: 5 })
      const hero = formatFlightLegTwoLines(aligned?.outbound)
      expect(hero?.arrivalAtText).toBe(obArr)
      expect(hero?.arrivalDayOffset).toBe(1)
      const sec = departureKeyFactsToHeroSsotItineraryFlightDisplay(aligned)
      expect(sec?.outbound?.arrivalAt).toBe(obArr)
      expect(sec?.inbound?.arrivalAt).toBe(ibArr)
    })
  }
})
