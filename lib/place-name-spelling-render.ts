/**
 * REGRESSION-FREEZE[place-name-spelling-n1]: 공개 상세 render model 표시용 지명 교정 — manifest
 *
 * 화면 출력 직전에만 적용한다. DB 저장값(Product.title·schedule·ItineraryDay·highlightPointsRaw 등
 * 공급사 원문)과 publicDetailPayloadJson 캐시는 바꾸지 않는다.
 * 문자열 화이트리스트 키만 바꾸고 숫자(가격·인원 등)는 건드리지 않는다.
 */
import type { ProductPublicDetailRenderModel } from '@/lib/product-public-detail/types'
import { normalizePlaceNameSpellingText as n } from '@/lib/place-name-spelling'

/** viewProduct 에서 교정하는 문자열 키 (가격·금액 문자열 키 없음) */
export const PLACE_NAME_RENDER_VIEW_PRODUCT_KEYS = [
  'title',
  'destination',
  'primaryDestination',
  'highlightPoints',
  'highlightPointsRaw',
  'hotelSummaryText',
  'hotelSummaryRaw',
  'freeTimeSummaryText',
] as const

const DAY_KEYS = ['title', 'description', 'city', 'hotelText', 'imageDisplayName', 'imageDisplayName2'] as const

type AnyRec = Record<string, unknown>

function mapKeys<T extends AnyRec>(o: T, keys: readonly string[]): T {
  let out: AnyRec | null = null
  for (const k of keys) {
    const v = o[k]
    if (typeof v !== 'string' || !v) continue
    const nv = n(v)
    if (nv !== v) {
      out ??= { ...o }
      out[k] = nv
    }
  }
  return (out ?? o) as T
}

function mapArr<T>(arr: T[] | null | undefined, f: (x: T) => T): T[] | null | undefined {
  if (!Array.isArray(arr)) return arr
  let changed = false
  const next = arr.map((x) => {
    const y = f(x)
    if (y !== x) changed = true
    return y
  })
  return changed ? next : arr
}

/** 추천일정(FIT master) — title/summary/day/activity 텍스트. estimatedCost* 는 건드리지 않음 */
function normalizeMaster(m: unknown): unknown {
  if (!m || typeof m !== 'object') return m
  const base = mapKeys(m as AnyRec, ['title', 'summary', 'cityNameKo'])
  const days = mapArr((base as AnyRec).days as AnyRec[] | undefined, (d) => {
    const dd = mapKeys(d, ['title', 'summary'])
    const acts = mapArr(dd.activities as AnyRec[] | undefined, (a) => mapKeys(a, ['title', 'description', 'location']))
    return acts === dd.activities ? dd : { ...dd, activities: acts }
  })
  return days === (base as AnyRec).days ? base : { ...base, days }
}

export function normalizeProductPublicDetailModelPlaceNames(
  model: ProductPublicDetailRenderModel,
): ProductPublicDetailRenderModel {
  if (!model || typeof model !== 'object') return model
  const vp0 = model.viewProduct as unknown as AnyRec
  let vp = mapKeys(vp0, PLACE_NAME_RENDER_VIEW_PRODUCT_KEYS)
  const schedule = mapArr(vp.schedule as AnyRec[] | null | undefined, (d) => mapKeys(d, DAY_KEYS))
  const itineraries = mapArr(vp.itineraries as AnyRec[] | null | undefined, (d) => mapKeys(d, ['description']))
  const hotelNames = mapArr(vp.hotelNames as string[] | null | undefined, (s) => n(s))
  if (schedule !== vp.schedule || itineraries !== vp.itineraries || hotelNames !== vp.hotelNames) {
    vp = { ...vp, schedule, itineraries, hotelNames }
  }
  const seo0 = model.seo as unknown as AnyRec
  let seo = mapKeys(seo0, ['productDescription'])
  const crumbs = mapArr(seo.breadcrumbItems as AnyRec[] | undefined, (c) => mapKeys(c, ['name']))
  const itin = mapArr(seo.itinerary as AnyRec[] | null | undefined, (c) => mapKeys(c, ['title', 'city']))
  if (crumbs !== seo.breadcrumbItems || itin !== seo.itinerary) seo = { ...seo, breadcrumbItems: crumbs, itinerary: itin }

  let next: AnyRec = model as unknown as AnyRec
  if (vp !== vp0) next = { ...next, viewProduct: vp }
  if (seo !== seo0) next = { ...next, seo }
  if (model.variant === 'air-hotel' && model.masterArg) {
    const ma = normalizeMaster(model.masterArg)
    if (ma !== model.masterArg) next = { ...next, masterArg: ma }
  }
  return next as unknown as ProductPublicDetailRenderModel
}
