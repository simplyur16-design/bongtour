/**
 * 교보이지(kyowontour) 전용 — 공개 상세 consumption resolution (선택관광·쇼핑·호텔 canonical / legacy 우선순위).
 *
 * 계약
 * - 호출부는 레거시 공용 resolution 합본·페이지 공통 모듈 선택기 없이 이 파일의 `resolve*`만 직접 호출한다.
 * - 이 파일만을 공개 상세 consumption 단일 진입으로 둔다.
 */
import { splitHotelNamesLine, type DayHotelPlan } from '@/lib/day-hotel-plans-kyowontour'
import type { ShoppingStopRow } from '@/lib/public-product-extras'
import { filterShoppingStopsForPublicDisplay } from '@/lib/shopping-public-row-filter'

export type ConsumptionDecision<T> = {
  value: T
  source: string
  usedFallback: boolean
}

export function buildOptionalToursStructuredJsonFromCanonical(
  canonical: {
    rows?: Array<{
      tourName?: string
      currency?: string
      adultPrice?: number | null
      childPrice?: number | null
      durationText?: string
      minPeopleText?: string
      guide同行Text?: string
      waitingPlaceText?: string
      descriptionText?: string
      noteText?: string
      priceText?: string
      supplierTags?: string[]
      includedNoExtraCharge?: boolean
    }>
  } | null | undefined
): string | null {
  type CanonicalOptionalRow = {
    id: string
    name: string
    currency: string | undefined
    adultPrice: number | null
    childPrice: number | null
    durationText: string | undefined
    minPaxText: string | undefined
    guide同行Text: string | undefined
    waitingPlaceText: string | undefined
    description: string | undefined
    alternateScheduleText: string | undefined
    priceText: string | undefined
    supplierTags: string[] | undefined
    includedNoExtraCharge?: boolean
    raw: string
  }
  const rows = Array.isArray(canonical?.rows) ? canonical.rows : []
  const mapped = rows
    .map((row, idx) => {
      const name = String(row?.tourName ?? '').trim()
      if (!name) return null
      const description = String(row?.descriptionText ?? '').trim() || undefined
      const alternateScheduleText = String(row?.noteText ?? '').trim() || undefined
      const priceText = String(row?.priceText ?? '').trim() || undefined
      const tags = Array.isArray(row?.supplierTags)
        ? row.supplierTags.map((t) => String(t).trim()).filter(Boolean)
        : []
      const raw = [name, description, alternateScheduleText, tags.join(' ')].filter(Boolean).join(' | ')
      return {
        id: `canonical-${idx + 1}`,
        name,
        currency: String(row?.currency ?? '').trim() || undefined,
        adultPrice: typeof row?.adultPrice === 'number' ? row.adultPrice : null,
        childPrice: typeof row?.childPrice === 'number' ? row.childPrice : null,
        durationText: String(row?.durationText ?? '').trim() || undefined,
        minPaxText: String(row?.minPeopleText ?? '').trim() || undefined,
        guide同行Text: String(row?.guide同行Text ?? '').trim() || undefined,
        waitingPlaceText: String(row?.waitingPlaceText ?? '').trim() || undefined,
        description,
        alternateScheduleText,
        priceText,
        supplierTags: tags.length ? tags : undefined,
        includedNoExtraCharge: row?.includedNoExtraCharge === true ? true : undefined,
        raw,
      } as CanonicalOptionalRow
    })
    .filter((x): x is CanonicalOptionalRow => x != null)
  return mapped.length > 0 ? JSON.stringify(mapped) : null
}

export function resolveOptionalToursConsumption(input: {
  canonical: {
    rows?: Array<{
      tourName?: string
      currency?: string
      adultPrice?: number | null
      childPrice?: number | null
      durationText?: string
      minPeopleText?: string
      guide同行Text?: string
      waitingPlaceText?: string
      descriptionText?: string
      noteText?: string
      priceText?: string
      supplierTags?: string[]
      includedNoExtraCharge?: boolean
    }>
  } | null | undefined
  legacyOptionalToursStructured: string | null | undefined
}): ConsumptionDecision<string | null> {
  const canonicalJson = buildOptionalToursStructuredJsonFromCanonical(input.canonical)
  if (canonicalJson) {
    return { value: canonicalJson, source: 'canonical_optional', usedFallback: false }
  }
  if (input.legacyOptionalToursStructured?.trim()) {
    return {
      value: input.legacyOptionalToursStructured,
      source: 'legacy_optional_tours_structured',
      usedFallback: true,
    }
  }
  return { value: null, source: 'none', usedFallback: false }
}

function visitNoFromCanonicalRow(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
  return null
}

function pickOptString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

/** rawMeta `shoppingStructured.rows` → 공개 `ShoppingStopRow` (candidateOnly·visitNo 등 메타 보존) */
export function buildShoppingStopsFromCanonical(
  canonical: {
    rows?: Array<{
      shoppingItem?: string
      shoppingPlace?: string
      durationText?: string
      refundPolicyText?: string
      noteText?: string
      city?: string | null
      shopName?: string | null
      shopLocation?: string | null
      itemsText?: string | null
      visitNo?: number | null
      candidateOnly?: boolean
      candidateGroupKey?: string | null
    }>
  } | null | undefined
): ShoppingStopRow[] {
  const rows = Array.isArray(canonical?.rows) ? canonical.rows : []
  return rows
    .map((row) => {
      const itemType = String(row?.shoppingItem ?? '').trim()
      const placeName = String(row?.shoppingPlace ?? '').trim()
      if (!itemType && !placeName) return null
      const noteTrim = String(row?.noteText ?? '').trim()
      const raw = [itemType, placeName, noteTrim].filter(Boolean).join(' | ')
      const out: ShoppingStopRow = {
        itemType: itemType || '—',
        placeName: placeName || '—',
        durationText: String(row?.durationText ?? '').trim() || null,
        refundPolicyText: String(row?.refundPolicyText ?? '').trim() || null,
        raw: raw || JSON.stringify(row ?? {}),
      }
      const city = pickOptString(row?.city)
      const shopName = pickOptString(row?.shopName)
      const shopLocation = pickOptString(row?.shopLocation)
      const itemsText = pickOptString(row?.itemsText)
      if (city) out.city = city
      if (shopName) out.shopName = shopName
      if (shopLocation) out.shopLocation = shopLocation
      if (itemsText) out.itemsText = itemsText
      if (noteTrim) out.noteText = noteTrim
      const vn = visitNoFromCanonicalRow(row?.visitNo)
      if (vn != null && Number.isFinite(vn)) out.visitNo = vn
      if (row?.candidateOnly === true) out.candidateOnly = true
      const cgk = pickOptString(row?.candidateGroupKey)
      if (cgk) out.candidateGroupKey = cgk
      return out
    })
    .filter((x): x is ShoppingStopRow => x != null)
}

export function resolveShoppingConsumption(input: {
  canonical: {
    rows?: Array<{
      shoppingItem?: string
      shoppingPlace?: string
      durationText?: string
      refundPolicyText?: string
      noteText?: string
      city?: string | null
      shopName?: string | null
      shopLocation?: string | null
      itemsText?: string | null
      visitNo?: number | null
      candidateOnly?: boolean
      candidateGroupKey?: string | null
    }>
  } | null | undefined
  legacyDbRows: ShoppingStopRow[]
  legacyMetaRows: ShoppingStopRow[]
}): ConsumptionDecision<ShoppingStopRow[]> {
  const canonicalRows = filterShoppingStopsForPublicDisplay(buildShoppingStopsFromCanonical(input.canonical))
  if (canonicalRows.length > 0) {
    return { value: canonicalRows, source: 'canonical_shopping', usedFallback: false }
  }
  const dbRows = filterShoppingStopsForPublicDisplay(input.legacyDbRows)
  if (dbRows.length > 0) {
    return { value: dbRows, source: 'legacy_shopping_db', usedFallback: true }
  }
  const metaRows = filterShoppingStopsForPublicDisplay(input.legacyMetaRows)
  if (metaRows.length > 0) {
    return { value: metaRows, source: 'legacy_shopping_meta', usedFallback: true }
  }
  return { value: [], source: 'none', usedFallback: false }
}

export function buildDayHotelPlansFromCanonicalHotel(
  canonical: {
    rows?: Array<{
      dayLabel?: string
      dateText?: string
      cityText?: string
      bookingStatusText?: string
      hotelNameText?: string
      hotelCandidates?: string[]
      noteText?: string
    }>
  } | null | undefined
): DayHotelPlan[] {
  const rows = Array.isArray(canonical?.rows) ? canonical.rows : []
  if (!rows.length) return []
  const plans: DayHotelPlan[] = []
  let seq = 1
  for (const row of rows) {
    const dayText = String(row?.dayLabel ?? '').trim()
    const dayMatch = dayText.match(/(\d+)/)
    const dayIndex = dayMatch ? Number(dayMatch[1]) : seq++
    const byCandidates = Array.isArray(row?.hotelCandidates)
      ? row.hotelCandidates.map((x) => String(x).trim()).filter(Boolean)
      : []
    const byName = splitHotelNamesLine(String(row?.hotelNameText ?? '').trim())
    const hotels = [...new Set([...byCandidates, ...byName])].filter(Boolean)
    if (hotels.length === 0) continue
    const label = dayText || `${dayIndex}일차 예정호텔`
    const raw = [
      String(row?.dateText ?? '').trim(),
      String(row?.cityText ?? '').trim(),
      String(row?.bookingStatusText ?? '').trim(),
      String(row?.hotelNameText ?? '').trim(),
      String(row?.noteText ?? '').trim(),
    ]
      .filter(Boolean)
      .join(' | ')
    plans.push({ dayIndex, label, hotels, raw: raw || undefined })
  }
  return plans.sort((a, b) => a.dayIndex - b.dayIndex)
}

export function resolveHotelConsumption(input: {
  canonical: {
    rows?: Array<{
      dayLabel?: string
      dateText?: string
      cityText?: string
      bookingStatusText?: string
      hotelNameText?: string
      hotelCandidates?: string[]
      noteText?: string
    }>
  } | null | undefined
  legacyStructuredPlans: DayHotelPlan[] | null | undefined
  hasLegacyNarrativeFallback: boolean
}): ConsumptionDecision<DayHotelPlan[] | null> {
  const canonicalPlans = buildDayHotelPlansFromCanonicalHotel(input.canonical)
  if (canonicalPlans.length > 0) {
    return { value: canonicalPlans, source: 'canonical_hotel', usedFallback: false }
  }
  if ((input.legacyStructuredPlans?.length ?? 0) > 0) {
    return {
      value: input.legacyStructuredPlans ?? null,
      source: 'legacy_day_hotel_plans',
      usedFallback: true,
    }
  }
  if (input.hasLegacyNarrativeFallback) {
    return { value: null, source: 'legacy_hotel_narrative', usedFallback: true }
  }
  return { value: null, source: 'none', usedFallback: false }
}
