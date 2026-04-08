import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { DeparturePreviewRow } from '@/lib/departure-preview'
import { addDaysIso, diffCalendarDaysIso, extractIsoDate, inferHeroReturnDayOffset } from '@/lib/hero-date-utils'
import { extractModetourBodyDepartureArrival } from '@/lib/modetour-body-dates'
import { normalizeSupplierOrigin, type OverseasSupplierKey } from '@/lib/normalize-supplier-origin'

export type HeroTripResolved = {
  departureIso: string | null
  returnIso: string | null
  /** structuredSignals·관리자 검수용 감사 문자열 */
  departureSource: string
  returnSource: string
  /**
   * 항공 구조화 등에서 만든 히어로 출발·귀국 **표시문** (날짜+시간).
   * 있으면 `formatHeroDateKorean(departureIso)` 대신 그대로 사용.
   */
  departureDisplayOverride?: string | null
  returnDisplayOverride?: string | null
}

function calendarDeparture(
  selectedDate: string | null,
  fallbackPriceRowDate: string | null | undefined
): string | null {
  if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return selectedDate
  const f = fallbackPriceRowDate
  if (f && f.startsWith('20') && f.length >= 10) return f.slice(0, 10)
  return null
}

function returnByDuration(departureIso: string | null, duration: string | null | undefined): { iso: string | null; source: string } {
  const off = inferHeroReturnDayOffset(duration)
  const iso = departureIso && off != null ? addDaysIso(departureIso, off) : null
  return { iso, source: iso ? 'duration_offset' : 'none' }
}

function returnFromListFacts(facts: DepartureKeyFacts | null): { iso: string | null; source: string } {
  if (!facts?.inbound) return { iso: null, source: 'none' }
  const ib = facts.inbound
  const iso =
    extractIsoDate(ib.arrivalAtText) ||
    extractIsoDate(ib.departureAtText) ||
    extractIsoDate(facts.inboundSummary ?? null)
  return { iso, source: iso ? 'departure_list_inbound' : 'none' }
}

/**
 * 히어로·여행기간 행 공통 — 출발은 달력 SSOT, 귀국은 공급사 정책 분기.
 * - 모두투어: 본문에 출발·도착(귀국) 문맥 날짜가 둘 다 있으면 그 **일수 차**를 달력 출발일에 더함, 없으면 N박·N일(duration)만
 * - 그 외: 출발일별 facts의 inbound(리스트) 우선, 없으면 duration fallback
 */
export function resolveHeroTripDates(opts: {
  originSource: string
  selectedDate: string | null
  fallbackPriceRowDate: string | null | undefined
  duration: string | null | undefined
  departureFacts: DepartureKeyFacts | null
  /** 모두투어만 — 등록 본문·상세에 남은 텍스트 blob */
  modetourBodyHaystack?: string | null | undefined
}): HeroTripResolved {
  const dep = calendarDeparture(opts.selectedDate, opts.fallbackPriceRowDate)
  const key: OverseasSupplierKey = normalizeSupplierOrigin(opts.originSource)

  if (key === 'modetour') {
    const raw = opts.modetourBodyHaystack ?? null
    const body = extractModetourBodyDepartureArrival(raw)
    let ret: string | null = null
    let retSrc = 'none'

    if (body.departureIso && body.arrivalIso) {
      const delta = diffCalendarDaysIso(body.departureIso, body.arrivalIso)
      if (delta != null && delta >= 0 && dep) {
        ret = addDaysIso(dep, delta)
        retSrc = 'modetour_raw_departure_arrival_span'
      }
    }

    if (!ret && dep) {
      const fb = returnByDuration(dep, opts.duration)
      ret = fb.iso
      retSrc = fb.iso ? 'modetour_duration_offset' : 'none'
    }

    return {
      departureIso: dep,
      returnIso: ret,
      departureSource: dep ? 'calendar' : 'none',
      returnSource: retSrc,
    }
  }

  const list = returnFromListFacts(opts.departureFacts)
  if (list.iso) {
    return {
      departureIso: dep,
      returnIso: list.iso,
      departureSource: dep ? 'calendar' : 'none',
      returnSource: list.source,
    }
  }

  const fb = returnByDuration(dep, opts.duration)
  return {
    departureIso: dep,
    returnIso: fb.iso,
    departureSource: dep ? 'calendar' : 'none',
    returnSource: fb.iso ? 'duration_fallback' : 'none',
  }
}

/** 등록 미리보기 행 → 상세 `DepartureKeyFacts`와 동일 형태(항공 줄형 UI·날짜 resolver 공용) */
export function departurePreviewRowToKeyFacts(row: DeparturePreviewRow | null): DepartureKeyFacts | null {
  if (!row) return null
  const obHas =
    row.outboundDepartureAirport ||
    row.outboundArrivalAirport ||
    row.outboundDepartureAt ||
    row.outboundArrivalAt ||
    row.outboundFlightNo
  const ibHas =
    row.inboundDepartureAirport ||
    row.inboundArrivalAirport ||
    row.inboundDepartureAt ||
    row.inboundArrivalAt ||
    row.inboundFlightNo
  const outbound = obHas
    ? {
        departureAirport: row.outboundDepartureAirport ?? null,
        departureAtText: row.outboundDepartureAt ?? null,
        arrivalAirport: row.outboundArrivalAirport ?? null,
        arrivalAtText: row.outboundArrivalAt ?? null,
        flightNo: row.outboundFlightNo ?? null,
      }
    : null
  const inbound = ibHas
    ? {
        departureAirport: row.inboundDepartureAirport ?? null,
        departureAtText: row.inboundDepartureAt ?? null,
        arrivalAirport: row.inboundArrivalAirport ?? null,
        arrivalAtText: row.inboundArrivalAt ?? null,
        flightNo: row.inboundFlightNo ?? null,
      }
    : null
  if (!outbound && !inbound) return null
  return {
    airline: row.carrierName ?? null,
    outbound,
    inbound,
    outboundSummary: null,
    inboundSummary: null,
    meetingSummary: null,
  }
}
