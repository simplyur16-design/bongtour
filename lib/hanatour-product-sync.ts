/**
 * 하나투어 Python sync-product / sync-full JSON → Prisma Product 업데이트 객체.
 * JSON 문자열 필드는 "[]" / null 기준 통일.
 */
import type { Prisma } from '@prisma/client'

function jstr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return null
    if (t === '[]') return '[]'
    try {
      JSON.parse(t)
      return t
    } catch {
      return JSON.stringify(v)
    }
  }
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

function nstr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function nbool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  return null
}

function nboolOrUndef(v: unknown): boolean | undefined {
  const b = nbool(v)
  return b === null ? undefined : b
}

function nnum(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Python `sync-product` / `sync-full` 의 product 객체 */
export type HanatourProductPayload = Record<string, unknown>

function omitUndefined<T extends Record<string, unknown>>(o: T): Prisma.ProductUpdateInput {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined)
  ) as Prisma.ProductUpdateInput
}

export function prismaProductUpdateFromHanatourPayload(
  p: HanatourProductPayload
): Prisma.ProductUpdateInput {
  const shoppingOpts = p.shoppingShopOptions
  const optStruct = p.optionalToursStructured
  return omitUndefined({
    rawTitle: nstr(p.rawTitle),
    normalizedBaseTitle: nstr(p.normalizedBaseTitle),
    variantLabelKey: nstr(p.variantLabelKey),
    supplierProductCode: nstr(p.supplierProductCode),
    originUrl: nstr(p.originUrl),
    title: nstr(p.title),
    destinationRaw: nstr(p.destinationRaw),
    duration: nstr(p.duration),
    airline: nstr(p.airline),
    priceFrom: nnum(p.priceFrom) ?? undefined,
    priceCurrency: nstr(p.priceCurrency),
    isFuelIncluded: nboolOrUndef(p.isFuelIncluded),
    isGuideFeeIncluded: nboolOrUndef(p.isGuideFeeIncluded),
    tripNights: nnum(p.tripNights) ?? undefined,
    tripDays: nnum(p.tripDays) ?? undefined,
    mandatoryLocalFee: nnum(p.mandatoryLocalFee) ?? undefined,
    mandatoryCurrency: nstr(p.mandatoryCurrency),
    includedText: nstr(p.includedText),
    excludedText: nstr(p.excludedText),
    criticalExclusions: nstr(p.criticalExclusions),
    meetingInfoRaw: nstr(p.meetingInfoRaw),
    guideTypeRaw: nstr(p.guideTypeRaw),
    tourLeaderTypeRaw: nstr(p.tourLeaderTypeRaw),
    themeLabelsRaw: nstr(p.themeLabelsRaw),
    promotionLabelsRaw: nstr(p.promotionLabelsRaw),
    insuranceSummaryRaw: nstr(p.insuranceSummaryRaw),
    hotelSummaryRaw: nstr(p.hotelSummaryRaw),
    foodSummaryRaw: nstr(p.foodSummaryRaw),
    reservationNoticeRaw: nstr(p.reservationNoticeRaw),
    currentBookedCount: nnum(p.currentBookedCount) ?? undefined,
    minimumDepartureCount: nnum(p.minimumDepartureCount) ?? undefined,
    minimumDepartureText: nstr(p.minimumDepartureText),
    benefitMonthRef: nstr(p.benefitMonthRef),
    hasMonthlyCardBenefit: nbool(p.hasMonthlyCardBenefit) ?? undefined,
    shoppingVisitCountTotal: nnum(p.shoppingVisitCountTotal) ?? undefined,
    shoppingCustomsNoticeRaw: nstr(p.shoppingCustomsNoticeRaw),
    shoppingRefundNoticeRaw: nstr(p.shoppingRefundNoticeRaw),
    shoppingCautionNoticeRaw: nstr(p.shoppingCautionNoticeRaw),
    shoppingShopOptions: shoppingOpts != null ? jstr(shoppingOpts) : '[]',
    hasOptionalTours: nbool(p.hasOptionalTours) ?? undefined,
    optionalTourSummaryRaw: nstr(p.optionalTourSummaryRaw),
    optionalToursStructured: optStruct != null ? jstr(optStruct) : '[]',
    detailStatusLabelsRaw: nstr(p.detailStatusLabelsRaw),
    rawMeta: p.rawMeta != null ? jstr(p.rawMeta) : undefined,
    summary: nstr(p.summary),
    benefitSummary: nstr(p.benefitSummary),
  })
}
