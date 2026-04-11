import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import {
  combineDateKeyWithHm,
  extractHmFromKoreanDateTimeLine,
  formatKoreanDateTimeLine,
} from '@/lib/flight-korean-datetime'
import { addDaysIso, extractIsoDate, formatHeroDateKorean, inferHeroReturnDayOffset } from '@/lib/hero-date-utils'

export type YbtourSelectedRowTripDisplays = {
  departureDisplay: string | null
  returnDisplay: string | null
}

/** `dateKey` 일자에 맞춰 `atText` 안의 시:분만 붙인다. 실패 시 null (원문 날짜를 그대로 쓰지 않음). */
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
 * 공개 ybtour 상세: **선택 가격 행의 출발일(`calendarDep`) + 그 일의 `departureKeyFacts`** 만으로
 * 여행기간 줄·상단 날짜·스티키 견적 카드에 넣을 출발/귀국 표시문을 만든다.
 * (원문에 다른 날짜가 박혀 있어도 출발 쪽 날짜는 `calendarDep`에 고정.)
 */
export function buildYbtourTripDateDisplaysForSelectedRow(opts: {
  /** `toDateKey(selectedPriceRow.date)` — 선택 행만 */
  calendarDep: string | null
  /** `departureKeyFactsByDate[calendarDep]` + 수동보정 결과 */
  facts: DepartureKeyFacts | null
  duration: string | null | undefined
}): YbtourSelectedRowTripDisplays {
  const { calendarDep, facts, duration } = opts
  if (!calendarDep || !/^\d{4}-\d{2}-\d{2}$/.test(calendarDep)) {
    return { departureDisplay: null, returnDisplay: null }
  }

  const depFromLeg = facts?.outbound?.departureAtText
    ? alignHmToDateKey(facts.outbound.departureAtText, calendarDep)
    : null
  const departureDisplay = depFromLeg ?? formatHeroDateKorean(calendarDep)

  let retIso = returnIsoFromFacts(facts)
  if (!retIso) {
    const off = inferHeroReturnDayOffset(duration)
    retIso = off != null ? addDaysIso(calendarDep, off) : null
  }

  const arrText = facts?.inbound?.arrivalAtText?.trim()
  const retFromLeg = retIso && arrText ? alignHmToDateKey(arrText, retIso) : null
  const returnDisplay = retFromLeg ?? (retIso ? formatHeroDateKorean(retIso) : null)

  return {
    departureDisplay,
    returnDisplay,
  }
}
