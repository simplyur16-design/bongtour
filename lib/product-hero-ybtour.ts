import type { FlightStructured } from '@/lib/detail-body-parser-types'
import type { PublicPersistedFlightStructuredDto } from '@/lib/public-flight-structured-sanitize'
import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import { addDaysIso, extractIsoDate, inferHeroReturnDayOffset } from '@/lib/hero-date-utils'
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

function combineYbtourFlightDateTime(d: string | null | undefined, t: string | null | undefined): string | null {
  const dd = (d ?? '').replace(/-/g, '.').trim()
  const tt = (t ?? '').trim()
  if (dd && tt) return `${dd} ${tt}`.replace(/\s+\(/g, '(')
  if (dd) return dd.replace(/\s+\(/g, '(')
  return tt || null
}

function tryYbtourHeroFromFlightStructured(
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
  const depLabel = combineYbtourFlightDateTime(ob.departureDate, ob.departureTime)
  const retLabel = combineYbtourFlightDateTime(ib.arrivalDate, ib.arrivalTime)
  if (!depLabel || !retLabel) return null

  const depIso = calendarDep ?? extractIsoDate(ob.departureDate)
  let retIso = extractIsoDate(ib.arrivalDate)
  let retSrc = 'ybtour_flight_structured_inbound_arrival'
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

  return {
    departureIso: depIso,
    returnIso: retIso,
    departureSource: depIso ? 'ybtour_flight_structured_outbound' : 'none',
    returnSource: retSrc,
    departureDisplayOverride: depLabel,
    returnDisplayOverride: retLabel,
  }
}

/**
 * 노랑풍선(ybtour) 등록 미리보기·공개 상세 히어로 — 구조화 항공에서 출발·귀국 시각 오버라이드 후 공용 `resolveHeroTripDates`로 폴백.
 */
export function resolveYbtourHeroTripDates(opts: {
  selectedDate: string | null
  fallbackPriceRowDate: string | null | undefined
  duration: string | null | undefined
  departureFacts: DepartureKeyFacts | null
  ybtourFlightStructured?: PublicPersistedFlightStructuredDto | null | undefined
}): HeroTripResolved {
  const dep = calendarDeparture(opts.selectedDate, opts.fallbackPriceRowDate)
  const yb = tryYbtourHeroFromFlightStructured(opts.ybtourFlightStructured, dep, opts.duration, opts.departureFacts)
  if (yb) return yb
  return resolveHeroTripDates({
    originSource: 'ybtour',
    selectedDate: opts.selectedDate,
    fallbackPriceRowDate: opts.fallbackPriceRowDate,
    duration: opts.duration,
    departureFacts: opts.departureFacts,
  })
}
