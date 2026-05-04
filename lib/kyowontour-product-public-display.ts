/**
 * 교원이지(kyowontour) 공개 상세·스티키 카드 전용 표시 문자열 (공급사 공용화 없음).
 */
import type { DepartureKeyFacts, DepartureLegCard } from '@/lib/departure-key-facts'

/** 스티키 카드 한 줄 — "현지옵션:" / "현지 선택 ·" 없이 고정 레이블만 사용 */
export function formatKyowontourStickyLocalPayPerPersonLine(
  fee: number | null | undefined,
  currency: string | null | undefined
): string | null {
  const f = Number(fee)
  if (!Number.isFinite(f) || f <= 0) return null
  const cRaw = String(currency ?? '').trim()
  if (!cRaw) return null
  const cUp = cRaw.toUpperCase()
  const isKrw = /^KRW$/i.test(cUp) || cRaw === '￦' || cRaw === '원'
  if (isKrw) {
    return `현지 지불경비(인당) ${Math.round(f).toLocaleString('ko-KR')}원`
  }
  const isJpy =
    /^JPY$/i.test(cUp) ||
    /^JP¥$/i.test(cRaw) ||
    cRaw === '¥' ||
    cRaw === '￥' ||
    /円/.test(cRaw)
  if (isJpy) {
    const n = Math.round(f)
    return `현지 지불경비(인당) ￥${n.toLocaleString('ja-JP')}`
  }
  const isUsd = /^USD$/i.test(cUp) || cRaw === '$'
  const curLabel = isUsd ? 'USD' : cUp
  const intLike = Number.isInteger(f) || Math.abs(f - Math.round(f)) < 1e-6
  const num = intLike ? String(Math.round(f)) : String(f)
  return `현지 지불경비(인당) ${curLabel} ${num}`
}

function compactLower(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * 포함/불포함 탭(불포함 칸)용 — "1인 객실 추가 사용료 320,000원" 형태.
 * 가격 카드·견적 합계에는 사용하지 않는다.
 */
export function buildKyowontourSingleRoomExcludedLineForTab(
  displayText: string | null | undefined,
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  const amt = amount != null && amount > 0 && Number.isFinite(amount) ? amount : null
  const c = (currency ?? 'KRW').toUpperCase()
  if (amt != null) {
    if (c === 'KRW' || !currency?.trim()) {
      return `1인 객실 추가 사용료 ${amt.toLocaleString('ko-KR')}원`
    }
    return `1인 객실 추가 사용료 ${amt.toLocaleString('ko-KR')} ${c}`
  }
  const collapsed = displayText?.replace(/\s+/g, ' ').trim()
  if (collapsed) {
    return collapsed
      .replace(/^1인실\s*객실\s*추가요금/i, '1인 객실 추가 사용료')
      .replace(/^1인\s*객실\s*추가\s*사용료/i, '1인 객실 추가 사용료')
  }
  return null
}

/** `ProductExtraInfoTabs` 불포함 칸 — 교원이지 사이트 노출 문구만 전용 정규화 */
export function mergeKyowontourExcludedWithSingleRoomForPublicTab(
  excludedText: string | null | undefined,
  singleRoomSurchargeDisplayText: string | null | undefined,
  singleRoomSurchargeAmount: number | null | undefined,
  singleRoomSurchargeCurrency: string | null | undefined
): string {
  const base = excludedText?.trim() ?? ''
  const extra = buildKyowontourSingleRoomExcludedLineForTab(
    singleRoomSurchargeDisplayText,
    singleRoomSurchargeAmount,
    singleRoomSurchargeCurrency
  )
  if (!extra) return base
  if (!base) return extra
  if (compactLower(base).includes(compactLower(extra))) return base
  const amtStr = singleRoomSurchargeAmount != null ? String(singleRoomSurchargeAmount) : ''
  if (amtStr && base.includes(amtStr) && /1인실|1인\s*객실|싱글|독실|단독|객실/i.test(base)) return base
  return `${base}\n\n${extra}`
}

function scrubKyowontourFlightFragment(s: string): string {
  let t = s.replace(/\bImage\b/gi, ' ')
  t = t.replace(/\b(?:가격예정|일정예정|항공예정|가격\s*예정|일정\s*예정)\b/gi, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

function stripKyowontourFlightNoiseToken(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  let t = scrubKyowontourFlightFragment(s)
  t = t.replace(/\s+예정\s*$/i, '').replace(/^\s*예정\s+/i, '').trim()
  if (!t) return null
  if (/^(?:예정|가격예정|일정예정|항공예정)$/i.test(t)) return null
  if (/^image$/i.test(t)) return null
  return t
}

function sanitizeKyowontourLegCard(leg: DepartureLegCard | null | undefined): DepartureLegCard | null {
  if (!leg) return null
  const departureAirport = stripKyowontourFlightNoiseToken(leg.departureAirport)
  const departureAtText = stripKyowontourFlightNoiseToken(leg.departureAtText)
  const arrivalAirport = stripKyowontourFlightNoiseToken(leg.arrivalAirport)
  const arrivalAtText = stripKyowontourFlightNoiseToken(leg.arrivalAtText)
  const flightNo = stripKyowontourFlightNoiseToken(leg.flightNo)
  const flightDurationText = leg.flightDurationText
    ? stripKyowontourFlightNoiseToken(scrubKyowontourFlightFragment(leg.flightDurationText))
    : null
  const has =
    departureAirport ||
    departureAtText ||
    arrivalAirport ||
    arrivalAtText ||
    flightNo ||
    flightDurationText
  if (!has) return null
  return {
    departureAirport,
    departureAtText,
    arrivalAirport,
    arrivalAtText,
    flightNo,
    flightDurationText: flightDurationText ?? null,
  }
}

/** 공개 상품 상세 항공여정 블록 — 입력/저장 경로는 건드리지 않고 사이트 노출 직전만 정리 */
export function sanitizeKyowontourPublicDepartureKeyFacts(facts: DepartureKeyFacts): DepartureKeyFacts {
  const outboundSummaryRaw = facts.outboundSummary ? scrubKyowontourFlightFragment(facts.outboundSummary) : ''
  const inboundSummaryRaw = facts.inboundSummary ? scrubKyowontourFlightFragment(facts.inboundSummary) : ''
  return {
    ...facts,
    airline: stripKyowontourFlightNoiseToken(facts.airline),
    outbound: sanitizeKyowontourLegCard(facts.outbound),
    inbound: sanitizeKyowontourLegCard(facts.inbound),
    outboundSummary: outboundSummaryRaw ? stripKyowontourFlightNoiseToken(outboundSummaryRaw) : null,
    inboundSummary: inboundSummaryRaw ? stripKyowontourFlightNoiseToken(inboundSummaryRaw) : null,
  }
}

export function sanitizeKyowontourPublicProductAirlineLine(airline: string | null | undefined): string | null {
  return stripKyowontourFlightNoiseToken(airline)
}
