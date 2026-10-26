/**
 * 교원이지 등록 — originUrl + goodsEvtTab_7 AJAX로 선택관광·쇼핑 자동 수집.
 * 붙여넣기 블록이 비어 있을 때만 보강(운영자 입력 SSOT 우선).
 *
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]: opt/shop mapping — manifest (수집은 tab-data-collect)
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-kyowontour'
import {
  extractKyowontourHiddenFieldsFromDetailHtml,
  fetchKyowontourOptShopTab,
  parseKyowontourOptShopTabDetail,
  type KyowontourOptShopTabParsed,
} from '@/lib/kyowontour-tour-event-tab-data'
import { finalizeKyowontourRegisterParsedShopping } from '@/lib/register-kyowontour-shopping'

const GOODS_EVENT_DETAIL_RE = /\/goods\/goodsEventDetail\b/i

export function isKyowontourGoodsEventDetailUrl(url: string | null | undefined): boolean {
  const u = (url ?? '').trim()
  return Boolean(u && GOODS_EVENT_DETAIL_RE.test(u))
}

function hasOptionalPaste(blocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null): boolean {
  return Boolean(blocks?.optionalTour?.trim())
}

function hasShoppingPaste(blocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null): boolean {
  return Boolean(blocks?.shopping?.trim())
}

function hasStructuredOptionalRows(parsed: RegisterParsed): boolean {
  const raw = parsed.optionalToursStructured
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function hasStructuredShoppingRows(parsed: RegisterParsed): boolean {
  const raw = parsed.shoppingStops
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

/**
 * tab7 파싱 결과 → 등록 필드.
 * tabDetailPresent=false(미수신·실패) → shopping unknown(null).
 * tabDetailPresent + 0행 → 명시 없음(hasShopping false / visit 0).
 */
export function optShopParsedToRegisterFields(parsed: KyowontourOptShopTabParsed): {
  optionalToursStructured: string | null
  shoppingStops: string | null
  shoppingVisitCount: number | null
  optionalTourCount: number | null
  hasOptionalTour: boolean | null
  hasShopping: boolean | null
} {
  const optionalRows = parsed.optionalTours.map((o) => ({
    name: o.name,
    description: o.description,
    priceAdult: o.priceAdult,
    priceChild: o.priceChild,
    priceInfant: o.priceInfant,
    currency: o.currency,
    duration: o.duration,
    alternativeProgram: o.alternativeProgram,
  }))
  const shoppingRows = parsed.shoppingItems.map((s) => ({
    itemName: s.itemName,
    shopLocation: s.shopLocation,
    duration: s.duration,
    refundable: s.refundable,
  }))
  const shopN = shoppingRows.length
  if (!parsed.tabDetailPresent) {
    return {
      optionalToursStructured: null,
      shoppingStops: null,
      shoppingVisitCount: null,
      optionalTourCount: null,
      hasOptionalTour: null,
      hasShopping: null,
    }
  }
  return {
    optionalToursStructured: optionalRows.length > 0 ? JSON.stringify(optionalRows) : null,
    shoppingStops: shopN > 0 ? JSON.stringify(shoppingRows) : null,
    shoppingVisitCount:
      shopN > 0
        ? parsed.shoppingVisitCount != null && parsed.shoppingVisitCount > 0
          ? parsed.shoppingVisitCount
          : shopN
        : 0,
    optionalTourCount: optionalRows.length > 0 ? optionalRows.length : 0,
    hasOptionalTour: optionalRows.length > 0,
    hasShopping: shopN > 0,
  }
}

/** register-facts shoppingPlaces — 있음 / 명시 없음(노쇼핑) / unknown([]) */
export function kyowontourOptShopToFactShoppingPlaces(parsed: KyowontourOptShopTabParsed): string[] {
  if (parsed.shoppingItems.length > 0) {
    return parsed.shoppingItems.map(
      (s) =>
        [s.itemName, s.shopLocation].filter(Boolean).join(' · ') ||
        `쇼핑 ${parsed.shoppingVisitCount ?? parsed.shoppingItems.length}회`,
    )
  }
  // 명시 없음: tab 수신·파싱 후 shopping_list 구조적 0건
  if (parsed.tabDetailPresent) return ['노쇼핑']
  return []
}

export async function collectKyowontourOptShopFromDetailUrl(
  detailUrl: string,
): Promise<{ ok: true; parsed: KyowontourOptShopTabParsed; summary: string } | { ok: false; reason: string }> {
  const url = detailUrl.trim()
  if (!isKyowontourGoodsEventDetailUrl(url)) {
    return { ok: false, reason: 'goodsEventDetail URL 아님' }
  }
  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BongTour/1.0)' },
    signal: AbortSignal.timeout(25_000),
  }).then((r) => r.text())
  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) {
    return { ok: false, reason: 'hidden 필드(tourId·masterCode) 없음' }
  }
  const { status, parsed } = await fetchKyowontourOptShopTab(hidden, { refererUrl: url })
  if (status !== 200) {
    return { ok: false, reason: `tourEventTabData HTTP ${status}` }
  }
  if (!parsed.tabDetailPresent) {
    return { ok: false, reason: 'goodsEvtTab_7 detail 없음/파싱불가' }
  }
  const summary = `goodsEvtTab_7: 선택관광 ${parsed.optionalTours.length}건, 쇼핑 ${parsed.shoppingVisitCount ?? 0}회`
  return { ok: true, parsed, summary }
}

export type KyowontourRegisterOptShopAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

/**
 * augmentParsed 이후 호출 — 붙여넣기·기존 structured가 없을 때만 AJAX로 채운다.
 */
export async function augmentKyowontourParsedWithOptShopCollect(
  parsed: RegisterParsed,
  ctx?: KyowontourRegisterOptShopAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  if (!originUrl || !isKyowontourGoodsEventDetailUrl(originUrl)) {
    return parsed
  }
  const needOpt = !hasOptionalPaste(ctx?.pastedBlocks) && !hasStructuredOptionalRows(parsed)
  const needShop = !hasShoppingPaste(ctx?.pastedBlocks) && !hasStructuredShoppingRows(parsed)
  if (!needOpt && !needShop) return parsed

  const collected = await collectKyowontourOptShopFromDetailUrl(originUrl)
  if (!collected.ok) {
    // fetch/detail 실패·미수신 → shopping unknown 유지 (없음으로 발명 금지)
    return {
      ...parsed,
      kyowontourOptShopCollectRan: false,
      kyowontourOptShopCollectSummary: `자동수집 스킵: ${collected.reason}`,
    }
  }

  const fields = optShopParsedToRegisterFields(collected.parsed)
  let next: RegisterParsed = { ...parsed }
  if (needOpt && fields.optionalToursStructured) {
    next = {
      ...next,
      optionalToursStructured: fields.optionalToursStructured,
      optionalTourCount: fields.optionalTourCount ?? next.optionalTourCount,
      hasOptionalTour: true,
    }
  } else if (needOpt && fields.hasOptionalTour === false) {
    next = { ...next, hasOptionalTour: false, optionalTourCount: 0 }
  }
  if (needShop) {
    if (fields.shoppingStops) {
      next = {
        ...next,
        shoppingStops: fields.shoppingStops,
        shoppingVisitCount: fields.shoppingVisitCount ?? next.shoppingVisitCount,
        hasShopping: true,
      }
    } else if (fields.hasShopping === false) {
      // tab 수신·파싱 후 구조적 0건 = 명시 없음
      next = {
        ...next,
        hasShopping: false,
        shoppingVisitCount: 0,
        shoppingSummaryText: next.shoppingSummaryText ?? '쇼핑 없음',
      }
    }
    // hasShopping == null → unknown 유지
    next = finalizeKyowontourRegisterParsedShopping(next)
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note = `교원이지 선택관광/쇼핑: ${collected.summary} (tourEventTabData goodsEvtTab_7)`
  if (!notes.includes(note)) notes.push(note)

  return {
    ...next,
    kyowontourOptShopCollectRan: true,
    kyowontourOptShopCollectSummary: collected.summary,
    registerPreviewPolicyNotes: notes,
  }
}
