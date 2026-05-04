import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { PublicPersistedFlightStructuredDto } from '@/lib/public-flight-structured-sanitize'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import {
  combineDateKeyWithHm,
  extractHmFromKoreanDateTimeLine,
  formatKoreanDateTimeLine,
} from '@/lib/flight-korean-datetime'
import { addDaysIso, extractIsoDate, formatHeroDateKorean, inferHeroReturnDayOffset } from '@/lib/hero-date-utils'
import { resolveHeroTripDates, type HeroTripResolved } from '@/lib/product-hero-dates'

function calendarDeparture(
  selectedDate: string | null,
  fallbackPriceRowDate: string | null | undefined
): string | null {
  if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return selectedDate
  const f = fallbackPriceRowDate
  if (f && f.startsWith('20') && f.length >= 10) return f.slice(0, 10)
  return null
}

function returnByDuration(
  departureIso: string | null,
  duration: string | null | undefined
): { iso: string | null; source: string } {
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

function combineKyowontourFlightDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`.replace(/\s+\(/g, '(')
  if (dd) return dd.replace(/\s+\(/g, '(')
  return tt || null
}

/** 선택 출발일(달력 SSOT) + 시각 문자열 → 해당 일자 기준 한 줄 표시 */
function alignKyowontourAtTextToDateIso(atText: string | null | undefined, dateIso: string | null): string | null {
  const raw = (atText ?? '').trim()
  if (!raw) return null
  if (dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const hm = extractHmFromKoreanDateTimeLine(raw)
    if (hm) {
      const d = combineDateKeyWithHm(dateIso, hm)
      if (d) return formatKoreanDateTimeLine(d)
    }
  }
  return raw
}

/**
 * 공개 상세에서 선택 행 날짜의 `departureKeyFacts`가 있으면,
 * 히어로 출발·귀국 표시는 구조화 본문(kyowontourFlightStructured)보다 이쪽만 쓴다(날짜·귀국 혼선 방지).
 */
function tryKyowontourHeroFromDepartureKeyFactsOnly(
  calendarDep: string | null,
  facts: DepartureKeyFacts,
  duration: string | null | undefined
): HeroTripResolved | null {
  if (!calendarDep || !/^\d{4}-\d{2}-\d{2}$/.test(calendarDep)) return null
  const dOut = facts.outbound?.departureAtText?.trim()
  const dInArr = facts.inbound?.arrivalAtText?.trim()
  if (!dOut || !dInArr) return null

  let retIso = extractIsoDate(dInArr)
  if (!retIso) {
    const list = returnFromListFacts(facts)
    retIso = list.iso
  }
  if (!retIso) {
    const fb = returnByDuration(calendarDep, duration)
    retIso = fb.iso
  }

  const depLabel = alignKyowontourAtTextToDateIso(dOut, calendarDep) ?? dOut
  const retLabel = (retIso ? alignKyowontourAtTextToDateIso(dInArr, retIso) : null) ?? dInArr

  return {
    departureIso: calendarDep,
    returnIso: retIso,
    departureSource: 'kyowontour_departure_key_facts',
    returnSource: retIso ? 'kyowontour_departure_key_facts_inbound' : 'none',
    departureDisplayOverride: depLabel,
    returnDisplayOverride: retLabel,
  }
}

/**
 * 출발/귀국 leg 중 하나만 있어도 **선택 출발일(`departureKeyFactsByDate`)** 기준으로 히어로를 맞춘다.
 * 본문 `flightStructured`와 섞지 않기 위한 공개 상세용.
 */
function tryKyowontourHeroFromDepartureKeyFactsPartial(
  calendarDep: string | null,
  facts: DepartureKeyFacts,
  duration: string | null | undefined
): HeroTripResolved | null {
  if (!calendarDep || !/^\d{4}-\d{2}-\d{2}$/.test(calendarDep)) return null
  const dOut = facts.outbound?.departureAtText?.trim()
  const dInArr = facts.inbound?.arrivalAtText?.trim()

  let retIso = dInArr ? extractIsoDate(dInArr) : null
  if (!retIso) {
    const list = returnFromListFacts(facts)
    retIso = list.iso
  }
  if (!retIso) {
    retIso = returnByDuration(calendarDep, duration).iso
  }

  const depLabel =
    (dOut ? alignKyowontourAtTextToDateIso(dOut, calendarDep) ?? dOut : null) ?? formatHeroDateKorean(calendarDep)

  let retLabel: string | null = null
  if (dInArr && retIso) {
    retLabel = alignKyowontourAtTextToDateIso(dInArr, retIso) ?? dInArr
  } else if (dInArr) {
    retLabel = dInArr
  } else if (retIso) {
    retLabel = formatHeroDateKorean(retIso)
  }

  if (!depLabel && !retLabel) return null

  return {
    departureIso: calendarDep,
    returnIso: retIso,
    departureSource: 'kyowontour_departure_key_facts_partial',
    returnSource: retIso
      ? dInArr
        ? 'kyowontour_departure_key_facts_inbound'
        : 'kyowontour_departure_key_facts_duration'
      : 'none',
    departureDisplayOverride: depLabel ?? null,
    returnDisplayOverride: retLabel ?? null,
  }
}

function tryKyowontourHeroFromFlightStructured(
  fs: Pick<FlightStructured, 'outbound' | 'inbound'> | null | undefined,
  calendarDep: string | null,
  duration: string | null | undefined,
  facts: DepartureKeyFacts | null
): HeroTripResolved | null {
  if (!fs?.outbound || !fs?.inbound) return null
  const ob = fs.outbound
  const ib = fs.inbound
  const obTime = (ob.departureTime ?? '').trim()
  const ibArrTime = (ib.arrivalTime ?? '').trim()
  if (!obTime || !ibArrTime) return null

  const depIso = calendarDep ?? extractIsoDate(ob.departureDate)
  let retIso = extractIsoDate(ib.arrivalDate)
  let retSrc = 'kyowontour_flight_structured_inbound_arrival'
  if (!retIso) {
    const list = returnFromListFacts(facts)
    retIso = list.iso
    retSrc = list.iso ? list.source : 'none'
  }
  if (!retIso && depIso) {
    const fb = returnByDuration(depIso, duration)
    retIso = fb.iso
    retSrc = fb.source
  }

  const depLabel = combineKyowontourFlightDateTime(depIso ?? ob.departureDate, obTime)
  const retLabel = combineKyowontourFlightDateTime(retIso ?? ib.arrivalDate, ibArrTime)
  if (!depLabel || !retLabel) return null

  return {
    departureIso: depIso,
    returnIso: retIso,
    departureSource: depIso ? 'kyowontour_flight_structured_outbound' : 'none',
    returnSource: retSrc,
    departureDisplayOverride: depLabel,
    returnDisplayOverride: retLabel,
  }
}

/**
 * 교원이지(kyowontour) 등록 미리보기·공개 상세 히어로 — 구조화 항공에서 출발·귀국 시각 오버라이드 후 공용 `resolveHeroTripDates`로 폴백.
 *
 * `disableFlightStructuredFallback`: true면 상품 본문 `kyowontourFlightStructured`를 쓰지 않는다(출발 행·`departureKeyFactsByDate`만 SSOT).
 */
export function resolveKyowontourHeroTripDates(opts: {
  selectedDate: string | null
  fallbackPriceRowDate: string | null | undefined
  duration: string | null | undefined
  departureFacts: DepartureKeyFacts | null
  kyowontourFlightStructured?: PublicPersistedFlightStructuredDto | null | undefined
  /** 공개 상세: 선택 출발 행과 본문 항공 blob이 어긋나는 것을 막기 위해 true */
  disableFlightStructuredFallback?: boolean
}): HeroTripResolved {
  const dep = calendarDeparture(opts.selectedDate, opts.fallbackPriceRowDate)
  if (opts.departureFacts) {
    const fromFacts = tryKyowontourHeroFromDepartureKeyFactsOnly(dep, opts.departureFacts, opts.duration)
    if (fromFacts) return fromFacts
    const fromFactsPartial = tryKyowontourHeroFromDepartureKeyFactsPartial(dep, opts.departureFacts, opts.duration)
    if (fromFactsPartial) return fromFactsPartial
  }
  if (!opts.disableFlightStructuredFallback) {
    const fromFlight = tryKyowontourHeroFromFlightStructured(
      opts.kyowontourFlightStructured,
      dep,
      opts.duration,
      opts.departureFacts
    )
    if (fromFlight) return fromFlight
  }
  return resolveHeroTripDates({
    originSource: 'kyowontour',
    selectedDate: opts.selectedDate,
    fallbackPriceRowDate: opts.fallbackPriceRowDate,
    duration: opts.duration,
    departureFacts: opts.departureFacts,
  })
}
