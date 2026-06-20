/**
 * 참좋은여행 등록 — PackageDetail HTML로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[verygoodtour-register-detail-collect]: augmentVerygoodtourParsedWithDetailCollect — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-verygoodtour'
import { buildVerygoodProductCoreFromDetailHtml } from '@/lib/verygoodtour-departures'
import { parseVerygoodItineraryFromDetailHtml } from '@/lib/verygoodtour-itinerary-collector'
import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-verygoodtour'
import { parseVerygoodProCodeFromUrl } from '@/lib/register-facts/verygoodtour'
import { finalizeVerygoodRegisterParsedShopping } from '@/lib/register-verygoodtour-shopping'

const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'

export type VerygoodtourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

function normalizeVerygoodDetailUrl(originUrl: string): string {
  const trimmed = originUrl.trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    const proCode = (u.searchParams.get('ProCode') ?? u.searchParams.get('procode') ?? '').trim()
    if (!proCode) return trimmed
    if (!u.searchParams.get('PriceSeq')) u.searchParams.set('PriceSeq', '1')
    return u.toString()
  } catch {
    return trimmed
  }
}

function hasOptionalPaste(ctx?: VerygoodtourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
}

function hasShoppingPaste(ctx?: VerygoodtourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.shopping?.trim())
}

function hasStructuredOptional(parsed: RegisterParsed): boolean {
  const raw = parsed.optionalToursStructured
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  const raw = parsed.shoppingStops
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

export function needsVerygoodtourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

export function needsVerygoodtourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  const hasIncl = (parsed.includedItems?.length ?? 0) > 0 || Boolean(parsed.includedText?.trim())
  const hasExcl = (parsed.excludedItems?.length ?? 0) > 0 || Boolean(parsed.excludedText?.trim())
  return !hasIncl && !hasExcl
}

export function needsVerygoodtourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

function bulletLinesFromText(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  return t
    .split(/\r?\n|(?<=[.;])\s+/)
    .map((l) => l.replace(/^[\s•·▪▶\-–—\d]+[.)]\s*/, '').trim())
    .filter((l) => l.length > 1 && l.length < 400)
}

function extractFeeLinesFromExcluded(excludedText: string): {
  singleRoomSurchargeRaw: string | null
  guideTipRaw: string | null
  visaRaw: string | null
} {
  const lines = bulletLinesFromText(excludedText)
  let singleRoomSurchargeRaw: string | null = null
  let guideTipRaw: string | null = null
  let visaRaw: string | null = null
  for (const line of lines) {
    if (!singleRoomSurchargeRaw && /(싱글|1인\s*객실|객실\s*1인|싱글룸|룸\s*사용)/i.test(line)) {
      singleRoomSurchargeRaw = line
    }
    if (!guideTipRaw && /(가이드|기사).*(경비|팁|비용)/i.test(line)) {
      guideTipRaw = line
    }
    if (!visaRaw && /(비자|visa)/i.test(line)) {
      visaRaw = line
    }
  }
  return { singleRoomSurchargeRaw, guideTipRaw, visaRaw }
}

function parseSingleRoomAmount(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
  if (!m) return null
  const n = Number(m[1]!.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function verygoodItineraryToRegisterSchedule(days: ItineraryDayInput[]): RegisterScheduleDay[] {
  return days.map((d) => {
    const title =
      (d.city ?? '').trim() ||
      (d.poiNamesRaw ?? '').trim().slice(0, 80) ||
      (d.summaryTextRaw ?? '').trim().split('\n')[0]?.slice(0, 80) ||
      `${d.day}일차`
    const description = (d.summaryTextRaw ?? d.rawBlock ?? title).trim().slice(0, 2000)
    return {
      day: d.day,
      title,
      description,
      imageKeyword: title.slice(0, 80),
      routeText: d.poiNamesRaw?.trim().slice(0, 200) || null,
      hotelText: d.accommodation?.trim() || null,
      mealSummaryText: d.meals?.trim() || null,
    }
  })
}

async function fetchVerygoodPackageDetailHtml(detailUrl: string): Promise<string | null> {
  const res = await fetch(detailUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
      referer: VERYGOODTOUR_BASE,
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  return res.text()
}

export async function augmentVerygoodtourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: VerygoodtourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = normalizeVerygoodDetailUrl(ctx?.originUrl ?? '')
  if (!originUrl || !parseVerygoodProCodeFromUrl(originUrl)) return parsed

  const needSchedule = needsVerygoodtourScheduleCollect(parsed)
  const needInclExcl = needsVerygoodtourIncludedExcludedCollect(parsed)
  const needMustKnow = needsVerygoodtourMustKnowCollect(parsed)
  const needOpt = !hasOptionalPaste(ctx?.pastedBlocks) && !hasStructuredOptional(parsed)
  const needShop =
    !hasShoppingPaste(ctx?.pastedBlocks) &&
    !hasStructuredShopping(parsed) &&
    parsed.shoppingVisitCount == null

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop) return parsed

  const html = await fetchVerygoodPackageDetailHtml(originUrl)
  if (!html) {
    return {
      ...parsed,
      verygoodtourDetailCollectRan: false,
      verygoodtourDetailCollectSummary: '자동수집 스킵: PackageDetail HTML 응답 없음',
    }
  }

  const { product } = buildVerygoodProductCoreFromDetailHtml(originUrl, html)
  const itinerary = parseVerygoodItineraryFromDetailHtml(html)
  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }

  if (needSchedule && itinerary.days.length > 0) {
    const scheduleDays = verygoodItineraryToRegisterSchedule(itinerary.days)
    next = { ...next, schedule: scheduleDays }
    summaryParts.push(`일정 ${scheduleDays.length}일차`)
  }

  if (product && needInclExcl) {
    const includedItems = bulletLinesFromText(product.includedText)
    const excludedItems = bulletLinesFromText(product.excludedText)
    const fees = extractFeeLinesFromExcluded(product.excludedText ?? '')
    if (fees.guideTipRaw && !excludedItems.some((x) => x.includes(fees.guideTipRaw!.slice(0, 10)))) {
      excludedItems.push(fees.guideTipRaw)
    }
    if (fees.singleRoomSurchargeRaw && !excludedItems.some((x) => /객실|싱글/i.test(x))) {
      excludedItems.push(fees.singleRoomSurchargeRaw)
    }
    if (fees.visaRaw && !excludedItems.some((x) => /비자/i.test(x))) {
      excludedItems.push(fees.visaRaw)
    }
    if (includedItems.length > 0) {
      next = {
        ...next,
        includedItems,
        includedText: includedItems.join('\n'),
        includedRaw: includedItems.join('\n'),
      }
    }
    if (excludedItems.length > 0) {
      next = {
        ...next,
        excludedItems,
        excludedText: excludedItems.join('\n'),
        excludedRaw: excludedItems.join('\n'),
      }
      summaryParts.push(`포함 ${includedItems.length}·불포함 ${excludedItems.length}`)
    }
    if (fees.singleRoomSurchargeRaw) {
      const amt = parseSingleRoomAmount(fees.singleRoomSurchargeRaw)
      next = {
        ...next,
        hasSingleRoomSurcharge: true,
        singleRoomSurchargeRaw: fees.singleRoomSurchargeRaw,
        singleRoomSurchargeDisplayText: fees.singleRoomSurchargeRaw,
        ...(amt != null ? { singleRoomSurchargeAmount: amt, singleRoomSurchargeCurrency: 'KRW' as const } : {}),
      }
    }
    if (product.mandatoryLocalFee != null) {
      next = {
        ...next,
        mandatoryLocalFee: product.mandatoryLocalFee,
        mandatoryCurrency: product.mandatoryCurrency ?? next.mandatoryCurrency,
      }
    }
  }

  if (product && needMustKnow && product.reservationNoticeRaw?.trim()) {
    const body = product.reservationNoticeRaw.trim().slice(0, 600)
    next = {
      ...next,
      mustKnowItems: [
        {
          category: '안전/유의',
          title: '예약 안내',
          body,
          raw: body,
        },
      ],
      mustKnowSource: 'supplier',
    }
    summaryParts.push('예약안내 1건')
  }

  if (product && needOpt) {
    if (product.hasOptionalTours === true && product.optionalTourSummaryRaw) {
      next = {
        ...next,
        hasOptionalTour: true,
        optionalTourSummaryText: product.optionalTourSummaryRaw.slice(0, 500),
      }
      summaryParts.push('선택관광 요약')
    } else if (product.noOptionFlag === true || product.hasOptionalTours === false) {
      next = { ...next, hasOptionalTour: false, optionalTourCount: 0 }
    }
  }

  if (product && needShop) {
    const visitCount = product.shoppingVisitCountTotal
    if (visitCount != null) {
      next = {
        ...next,
        shoppingVisitCount: visitCount,
        hasShopping: visitCount > 0,
        shoppingSummaryText: visitCount > 0 ? `쇼핑 ${visitCount}회` : '쇼핑 없음',
      }
      summaryParts.push(`쇼핑 ${visitCount}회`)
    } else if (product.noShoppingFlag === true) {
      next = {
        ...next,
        shoppingVisitCount: 0,
        hasShopping: false,
        shoppingSummaryText: '쇼핑 없음',
      }
    }
    next = finalizeVerygoodRegisterParsedShopping(next)
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `참좋은여행 상세카드 자동수집: ${summaryParts.join(' · ')} (PackageDetail HTML)`
      : '참좋은여행 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return {
    ...next,
    verygoodtourDetailCollectRan: summaryParts.length > 0,
    verygoodtourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  }
}
