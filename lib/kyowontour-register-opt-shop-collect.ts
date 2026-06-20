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

export function optShopParsedToRegisterFields(parsed: KyowontourOptShopTabParsed): {
  optionalToursStructured: string | null
  shoppingStops: string | null
  shoppingVisitCount: number | null
  optionalTourCount: number | null
  hasOptionalTour: boolean
  hasShopping: boolean
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
  return {
    optionalToursStructured: optionalRows.length > 0 ? JSON.stringify(optionalRows) : null,
    shoppingStops: shoppingRows.length > 0 ? JSON.stringify(shoppingRows) : null,
    shoppingVisitCount: parsed.shoppingVisitCount > 0 ? parsed.shoppingVisitCount : null,
    optionalTourCount: optionalRows.length > 0 ? optionalRows.length : null,
    hasOptionalTour: optionalRows.length > 0,
    hasShopping: shoppingRows.length > 0,
  }
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
  if (parsed.optionalTours.length === 0 && parsed.shoppingItems.length === 0) {
    return { ok: false, reason: 'goodsEvtTab_7 선택관광·쇼핑 0건' }
  }
  const summary = `goodsEvtTab_7: 선택관광 ${parsed.optionalTours.length}건, 쇼핑 ${parsed.shoppingVisitCount}회`
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
  }
  if (needShop && fields.shoppingStops) {
    next = {
      ...next,
      shoppingStops: fields.shoppingStops,
      shoppingVisitCount: fields.shoppingVisitCount ?? next.shoppingVisitCount,
      hasShopping: true,
    }
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
