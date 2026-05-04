/**
 * 교원이지(kyowontour) — 공개 목록·상세용 표시 변환 / Product 적재 입력 (Phase 2-F).
 * 4공급사 public-consumption-* 와 분리; DB 스키마 공용 컬럼만 사용.
 */
import type { ProductDeparture } from '@prisma/client'

import type { KyowontourFinalParsed, KyowontourScheduleFinal } from '@/lib/kyowontour/orchestration'

const ORIGIN_SOURCE = 'kyowontour' as const

/** Prisma `Product` 생성·갱신 시 채울 스칼라 부분(필요 필드만; 나머지는 호출부/DB 기본). */
export type ProductUpsertInput = {
  originSource: string
  originCode: string
  title: string
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
  supplierGroupId: string | null
  supplierProductCode: string | null
  rawTitle: string | null
  duration: string | null
  airline: string | null
  priceFrom: number | null
  priceCurrency: string | null
  schedule: string | null
  includedText: string | null
  excludedText: string | null
  criticalExclusions: string | null
  shoppingCount: number | null
  shoppingItems: string | null
  shoppingVisitCountTotal: number | null
  isFuelIncluded: boolean | null
  isGuideFeeIncluded: boolean | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  hotelSummaryRaw: string | null
  hotelSummaryText: string | null
  reservationNoticeRaw: string | null
  optionalToursStructured: string | null
  hasOptionalTours: boolean | null
  flightAdminJson: string | null
  rawMeta: string | null
  tripNights: number | null
  tripDays: number | null
  counselingNotes: string | null
}

export type PublicCalendarRow = {
  departureDateIso: string
  adultPriceDisplay: string
  childPriceDisplay: string | null
  infantPriceDisplay: string | null
  statusLine: string | null
  seatsLine: string | null
  carrierLine: string | null
  supplierCodeLine: string | null
  bookable: boolean | null
}

export type PublicSchedule = {
  day: number
  title: string | null
  lines: string[]
  hotel: string | null
  meals: { breakfast: string; lunch: string; dinner: string }
}

function nonEmpty(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t || null
}

function bullets(lines: string[]): string | null {
  const xs = lines.map((x) => x.trim()).filter(Boolean)
  if (!xs.length) return null
  return xs.map((x) => `· ${x}`).join('\n')
}

/** N박M일 → tripNights, tripDays */
export function parseKyowontourDurationLabel(label: string | null | undefined): {
  tripNights: number | null
  tripDays: number | null
} {
  const m = String(label ?? '').match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return { tripNights: null, tripDays: null }
  const n = Number(m[1])
  const d = Number(m[2])
  return {
    tripNights: Number.isFinite(n) ? n : null,
    tripDays: Number.isFinite(d) ? d : null,
  }
}

/**
 * 성인 표시가 = 상품가 + 유류할증(별도일 때 합산). breakdown은 카드·툴팁용.
 */
export function formatKyowontourAdultPriceForPublic(
  basePrice: number | null | undefined,
  fuelSurcharge: number | null | undefined
): { displayPrice: number; breakdown: string[] } {
  const base = basePrice != null && Number.isFinite(basePrice) && basePrice > 0 ? Math.round(basePrice) : 0
  const fuel = fuelSurcharge != null && Number.isFinite(fuelSurcharge) && fuelSurcharge > 0 ? Math.round(fuelSurcharge) : 0
  if (base <= 0 && fuel <= 0) {
    return { displayPrice: 0, breakdown: ['가격 미정 또는 별도 문의'] }
  }
  const total = base + fuel
  const out: string[] = []
  if (base > 0) out.push(`상품가 ${base.toLocaleString('ko-KR')}원`)
  if (fuel > 0) out.push(`유류할증료 ${fuel.toLocaleString('ko-KR')}원`)
  if (base > 0 && fuel > 0) out.push(`합계 ${total.toLocaleString('ko-KR')}원`)
  return { displayPrice: total > 0 ? total : base, breakdown: out }
}

/** 일정 → 공개 카드용(제목·요약 줄·식사). */
export function formatKyowontourScheduleForPublic(schedule: KyowontourScheduleFinal[]): PublicSchedule[] {
  if (!schedule?.length) return []
  return schedule
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => {
      const lines: string[] = []
      for (const a of d.activities ?? []) {
        const t = String(a ?? '').trim()
        if (t) lines.push(t)
      }
      return {
        day: d.dayNumber,
        title: nonEmpty(d.title),
        lines,
        hotel: nonEmpty(d.hotel),
        meals: {
          breakfast: (d.meals?.breakfast ?? '').trim(),
          lunch: (d.meals?.lunch ?? '').trim(),
          dinner: (d.meals?.dinner ?? '').trim(),
        },
      }
    })
}

function buildOptionalToursStructuredJson(tours: KyowontourFinalParsed['optionalTours']): string | null {
  if (!tours?.length) return null
  const rows = tours.map((t, idx) => ({
    id: `kyowontour-opt-${idx + 1}`,
    name: String(t.name ?? '').trim(),
    currency: t.currency,
    adultPrice: t.priceAdult,
    childPrice: t.priceChild,
    infantPrice: t.priceInfant,
    durationText: String(t.duration ?? '').trim() || undefined,
    description: String(t.description ?? '').trim() || undefined,
    alternateScheduleText: String(t.alternativeProgram ?? '').trim() || undefined,
    raw: [t.name, t.description].filter(Boolean).join(' | '),
  }))
  return JSON.stringify(rows)
}

function buildFlightAdminJson(parsed: KyowontourFinalParsed): string | null {
  const f = parsed.flight
  if (!f?.outbound?.flightNo?.trim() || !f?.inbound?.flightNo?.trim()) return null
  return JSON.stringify({
    supplier: ORIGIN_SOURCE,
    airline: f.airline,
    outbound: f.outbound,
    inbound: f.inbound,
  })
}

function destinationFromTitle(title: string): string {
  const t = title.trim()
  if (!t) return '미지정'
  const cut = t.split(/[|｜]/)[0]?.trim() ?? t
  return cut.slice(0, 120) || '미지정'
}

/**
 * 제목·일정·포함·코드에서 검색 토큰 추출(중복 제거, 공백 정규화).
 */
export function extractKyowontourSearchKeywords(parsed: KyowontourFinalParsed): string[] {
  const bag: string[] = []
  const push = (s: string) => {
    const t = s.trim()
    if (t.length >= 2) bag.push(t)
  }
  push(parsed.title)
  push(parsed.durationLabel)
  push(parsed.productCode)
  const { tripDays } = parseKyowontourDurationLabel(parsed.durationLabel)
  if (tripDays != null) push(`${tripDays}일`)

  for (const d of parsed.schedule ?? []) {
    if (d.title) push(String(d.title))
    for (const a of d.activities ?? []) {
      const parts = String(a).split(/[\s,./·]+/).filter((x) => x.length >= 2 && !/^\d+$/.test(x))
      bag.push(...parts.slice(0, 8))
    }
  }
  for (const x of parsed.includedItems ?? []) push(String(x))
  const blob = `${parsed.title} ${parsed.durationLabel} ${(parsed.schedule ?? []).map((d) => [d.title, ...(d.activities ?? [])].join(' ')).join(' ')}`
  if (/가오슝|타이난|타이중|대만|타이완/i.test(blob)) {
    push('대만')
    push('타이완')
  }
  if (/오사카|교토|간사이/i.test(blob)) push('일본')
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of bag) {
    const k = w.replace(/\s+/g, ' ').trim()
    const lower = k.toLowerCase()
    if (!k || k.length < 2) continue
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(k)
    if (out.length >= 48) break
  }
  return out
}

/**
 * `KyowontourFinalParsed` → `Product` upsert용 입력(제목 원문 보존).
 */
export function mapKyowontourFinalToProductUpsertInput(
  parsed: KyowontourFinalParsed,
  options?: { adminUserId?: string }
): ProductUpsertInput {
  const dest = destinationFromTitle(parsed.title)
  const { tripNights, tripDays } = parseKyowontourDurationLabel(parsed.durationLabel)
  const { displayPrice } = formatKyowontourAdultPriceForPublic(parsed.priceAdult, parsed.fuelSurcharge)
  const scheduleJson = JSON.stringify(formatKyowontourScheduleForPublic(parsed.schedule))

  const shoppingLines = (parsed.shoppingItems ?? []).map((s) =>
    [s.itemName, s.shopLocation].filter(Boolean).join(' — ')
  )
  const optJson = buildOptionalToursStructuredJson(parsed.optionalTours)

  const meeting = parsed.meetingInfo
  const meetingBlock = meeting
    ? [`미팅 장소: ${meeting.location || '—'}`, `미팅 시간: ${meeting.time || '—'}`].join('\n')
    : null

  const rawMetaObj = {
    supplier: ORIGIN_SOURCE,
    productCode: parsed.productCode,
    expectedDayCount: parsed.expectedDayCount,
    warnings: parsed.warnings?.slice(0, 20),
    originalBodyEmpty: !(parsed.originalBodyText ?? '').trim(),
    adminUserId: options?.adminUserId ?? null,
  }

  return {
    originSource: ORIGIN_SOURCE,
    originCode: parsed.productCode.trim(),
    title: parsed.title.trim() || '상품명 없음',
    destination: dest,
    destinationRaw: dest,
    primaryDestination: dest,
    supplierGroupId: parsed.productCode.length >= 6 ? parsed.productCode.slice(0, 6) : parsed.productCode,
    supplierProductCode: parsed.productCode,
    rawTitle: parsed.title.trim() || null,
    duration: nonEmpty(parsed.durationLabel),
    airline: nonEmpty(parsed.flight?.airline) ?? nonEmpty(parsed.hotelGradeLabel),
    priceFrom: displayPrice > 0 ? displayPrice : parsed.priceAdult > 0 ? parsed.priceAdult : null,
    priceCurrency: 'KRW',
    schedule: scheduleJson,
    includedText: bullets(parsed.includedItems ?? []),
    excludedText: bullets(parsed.excludedItems ?? []),
    criticalExclusions: nonEmpty(parsed.excludedItems?.slice(0, 3).join(' / ')),
    shoppingCount: shoppingLines.length > 0 ? shoppingLines.length : null,
    shoppingItems: shoppingLines.length ? shoppingLines.join('\n') : null,
    shoppingVisitCountTotal: shoppingLines.length > 0 ? shoppingLines.length : null,
    /** `priceFrom`에 유류할증을 합산해 두었으면 포함으로 표기 */
    isFuelIncluded:
      parsed.fuelSurcharge != null && parsed.fuelSurcharge > 0 && parsed.priceAdult > 0 ? true : null,
    isGuideFeeIncluded: false,
    mandatoryLocalFee: null,
    mandatoryCurrency: null,
    hotelSummaryRaw: nonEmpty(parsed.hotelGradeLabel),
    hotelSummaryText: nonEmpty(parsed.hotelGradeLabel),
    reservationNoticeRaw: meetingBlock,
    optionalToursStructured: optJson,
    hasOptionalTours: (parsed.optionalTours?.length ?? 0) > 0,
    flightAdminJson: buildFlightAdminJson(parsed),
    rawMeta: JSON.stringify(rawMetaObj),
    tripNights,
    tripDays,
    counselingNotes: parsed.warnings?.length
      ? JSON.stringify({ kyowontourRegisterWarnings: parsed.warnings })
      : null,
  }
}

function moneyKrw(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/**
 * `ProductDeparture` → 공개 캘린더 한 줄.
 */
export function formatKyowontourDepartureForPublicCalendar(departure: ProductDeparture): PublicCalendarRow {
  const d = departure.departureDate
  const iso =
    d instanceof Date && !Number.isNaN(d.getTime())
      ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      : ''
  const adult = moneyKrw(departure.adultPrice ?? null) ?? '—'
  const child =
    departure.childBedPrice != null || departure.childNoBedPrice != null
      ? moneyKrw(departure.childBedPrice ?? departure.childNoBedPrice ?? null)
      : null
  const infant = moneyKrw(departure.infantPrice ?? null)
  return {
    departureDateIso: iso,
    adultPriceDisplay: adult,
    childPriceDisplay: child,
    infantPriceDisplay: infant,
    statusLine: nonEmpty(departure.statusRaw),
    seatsLine: nonEmpty(departure.seatsStatusRaw),
    carrierLine: nonEmpty(departure.carrierName),
    supplierCodeLine: nonEmpty(departure.supplierDepartureCodeCandidate),
    bookable: departure.isBookable ?? null,
  }
}
