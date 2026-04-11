import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import {
  combineDateKeyWithHm,
  extractHmFromKoreanDateTimeLine,
  formatKoreanDateTimeLine,
} from '@/lib/flight-korean-datetime'
import { diffCalendarDaysIso, extractIsoDate, formatHeroDateKorean } from '@/lib/hero-date-utils'

export type VerygoodSelectedRowTripDisplays = {
  departureDisplay: string | null
  returnDisplay: string | null
  /** 선택 출발행 귀국일(ISO) 기준 N박 M일 — 본문 `product.duration` 미사용 */
  durationLabel: string | null
}

function alignHmToDateKey(atText: string | null | undefined, dateKey: string | null): string | null {
  const raw = (atText ?? '').trim()
  if (!raw) return null
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const hm = extractHmFromKoreanDateTimeLine(raw)
  if (!hm) return null
  const d = combineDateKeyWithHm(dateKey, hm)
  if (!d) return null
  return formatKoreanDateTimeLine(d)
}

function returnIsoFromFacts(facts: DepartureKeyFacts | null): string | null {
  if (!facts?.inbound) return null
  const ib = facts.inbound
  return (
    extractIsoDate(ib.arrivalAtText) ||
    extractIsoDate(ib.departureAtText) ||
    extractIsoDate(facts.inboundSummary ?? null)
  )
}

/**
 * 참좋은(verygoodtour) 상세: 선택 **출발 행 id**에 매칭된 `DepartureKeyFacts`만으로
 * 히어로·여행기간·견적 일정 표기를 통일한다. (동일 일자 다행 시 날짜 키만으로는 부족)
 */
export function buildVerygoodTripDateDisplaysForSelectedRow(opts: {
  calendarDep: string | null
  facts: DepartureKeyFacts | null
}): VerygoodSelectedRowTripDisplays {
  const { calendarDep, facts } = opts
  if (!calendarDep || !/^\d{4}-\d{2}-\d{2}$/.test(calendarDep)) {
    return { departureDisplay: null, returnDisplay: null, durationLabel: null }
  }

  const depFromLeg = facts?.outbound?.departureAtText
    ? alignHmToDateKey(facts.outbound.departureAtText, calendarDep)
    : null
  const departureDisplay = depFromLeg ?? formatHeroDateKorean(calendarDep)

  const retIso = returnIsoFromFacts(facts)

  const arrText = facts?.inbound?.arrivalAtText?.trim()
  const retFromLeg = retIso && arrText ? alignHmToDateKey(arrText, retIso) : null
  const returnDisplay = retFromLeg ?? (retIso ? formatHeroDateKorean(retIso) : null)

  let durationLabel: string | null = null
  if (retIso) {
    const diff = diffCalendarDaysIso(calendarDep, retIso)
    if (diff != null && diff >= 0) {
      durationLabel = `${diff}박 ${diff + 1}일`
    }
  }

  return { departureDisplay, returnDisplay, durationLabel }
}

/**
 * 공개 상세 직렬화용: DB `ProductDeparture` 출발·귀국 시각만으로 `N박 N+1일` (본문 `product.duration` 미사용).
 */
function verygoodCoerceDepartureAtToDate(v: Date | string | null | undefined): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim().includes('T') ? v.trim() : v.trim().replace(' ', 'T'))
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

export function verygoodDurationLabelFromDepartureAtPair(
  outboundDepartureAt: Date | string | null | undefined,
  inboundArrivalAt: Date | string | null | undefined
): string | null {
  const out = verygoodCoerceDepartureAtToDate(outboundDepartureAt)
  const inn = verygoodCoerceDepartureAtToDate(inboundArrivalAt)
  if (!out || !inn) return null
  const depIso = out.toISOString().slice(0, 10)
  const retIso = inn.toISOString().slice(0, 10)
  const diff = diffCalendarDaysIso(depIso, retIso)
  if (diff == null || diff < 0) return null
  return `${diff}박 ${diff + 1}일`
}
