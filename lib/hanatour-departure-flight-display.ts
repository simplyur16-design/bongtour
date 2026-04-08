/**
 * 하나투어 전용: 출발확정·예약현황 표시 — 본문 근거 없는 `출발확정`·달력 status 오탐 차단.
 */
import { buildDepartureStatusDisplay } from '@/lib/minimum-departure-extract'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

/** 하나투어에서만 허용하는 출발확정 근거(행사 확정 등 마케팅 문구 제외) */
export function hanatourExplicitDepartureGuaranteedInHaystack(hay: string): boolean {
  const flat = hay.replace(/\s+/g, ' ')
  if (!flat.trim()) return false
  if (/출발\s*미\s*확정|미\s*확정\s*출발|출발\s*불\s*확정/i.test(flat)) return false
  if (/\[출발확정\]/i.test(flat)) return true
  if (/무조건\s*출발|★\s*무조건\s*출발|無條件\s*出發/i.test(flat)) return true
  if (/출발\s*확정\s*(?:됨|안내|예정)/i.test(flat)) return true
  if (/(?:^|[\s\[\]#•·,|/])출발\s*확정(?:$|[\s\]\]#•·,|/]|항공|일정|상품)/i.test(flat)) return true
  return false
}

export function buildHanatourDepartureEvidenceHaystack(p: {
  title?: string | null
  duration?: string | null
  includedText?: string | null
  excludedText?: string | null
  priceTableRawText?: string | null
  promotionLabelsRaw?: string | null
  benefitSummary?: string | null
  detailBodyNormalizedRaw?: string | null
  flightStructured?: { detailBodyNormalizedRaw?: string | null } | null
}): string {
  const normBody =
    p.detailBodyNormalizedRaw?.trim() || p.flightStructured?.detailBodyNormalizedRaw?.trim() || ''
  return [
    normBody,
    p.title,
    p.duration,
    p.includedText,
    p.excludedText,
    p.priceTableRawText,
    p.promotionLabelsRaw,
    p.benefitSummary,
  ]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join('\n')
}

export function stripHanatourFalseDepartureGuaranteedFromStatusLine(s: string): string {
  const parts = s
    .split(/\s*·\s*/)
    .map((x) => x.trim())
    .filter(Boolean)
  const filtered = parts.filter((p) => !/^출발\s*확정$/i.test(p))
  return filtered.join(' · ').trim()
}

export type HanatourDepartureProductFields = {
  departureStatusText?: string | null
  minimumDepartureCount?: number | null
  minimumDepartureText?: string | null
  isDepartureGuaranteed?: boolean | null
  currentBookedCount?: number | null
  remainingSeatsCount?: number | null
  title?: string | null
  duration?: string | null
  includedText?: string | null
  excludedText?: string | null
  priceTableRawText?: string | null
  promotionLabelsRaw?: string | null
  benefitSummary?: string | null
  flightStructured?: { detailBodyNormalizedRaw?: string | null } | null
}

/** 공개 상세·스티키: `departureStatusText`에 박힌 허위 출발확정도 제거 */
export function formatHanatourDepartureConditionForProduct(p: HanatourDepartureProductFields): string | null {
  const hay = buildHanatourDepartureEvidenceHaystack(p)
  const explicit = hanatourExplicitDepartureGuaranteedInHaystack(hay)
  const raw = (p.departureStatusText ?? '').trim()
  if (raw) {
    if (explicit) return raw
    const cleaned = stripHanatourFalseDepartureGuaranteedFromStatusLine(raw)
    if (cleaned) return cleaned
  }
  return buildDepartureStatusDisplay({
    isDepartureGuaranteed: explicit && p.isDepartureGuaranteed === true,
    minimumDepartureCount: p.minimumDepartureCount ?? null,
    currentBookedCount: p.currentBookedCount ?? null,
    minimumDepartureText: p.minimumDepartureText?.trim() || null,
    remainingSeatsCount: p.remainingSeatsCount ?? null,
  })
}

/**
 * 등록 파싱 직후: 공용 `extractMinimumDepartureMeta`의 `행사\s*확정` 등 오탐·LLM 플래그 정리.
 */
export function sanitizeHanatourRegisterParsedDepartureFields(
  parsed: RegisterParsed,
  normalizedBody: string
): RegisterParsed {
  const hay = [
    normalizedBody,
    parsed.title,
    parsed.includedText,
    parsed.excludedText,
  ]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join('\n')
  if (hanatourExplicitDepartureGuaranteedInHaystack(hay)) return parsed

  const raw = (parsed.departureStatusText ?? '').trim()
  const cleaned = raw ? stripHanatourFalseDepartureGuaranteedFromStatusLine(raw) : ''
  return {
    ...parsed,
    isDepartureGuaranteed: null,
    departureStatusText: cleaned || null,
  }
}

/** 달력 행 `status`가 출발확정만 있는데 본문 근거가 없으면 병합하지 않음 */
export function hanatourShouldAppendDepartureStatusBlob(
  seatBlob: string,
  haystackForEvidence: string
): boolean {
  const t = seatBlob.replace(/\s+/g, ' ').trim()
  if (!t) return false
  const onlyGuaranteed = /^출발\s*확정$/i.test(t)
  if (onlyGuaranteed && !hanatourExplicitDepartureGuaranteedInHaystack(haystackForEvidence)) return false
  return true
}
