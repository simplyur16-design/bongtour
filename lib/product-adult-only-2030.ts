/**
 * 2030(또래·성인 전용) 상품 — 아동·유아 요금/인원 비노출 SSOT.
 * REGRESSION-FREEZE[product-adult-only-2030]: title·tag detect + strip helpers — manifest
 */

/** 하나투어 2030 TRP 제목 감지 (등록·공개·관리자 공용). */
export const PRODUCT_2030_TITLE_RE =
  /\[?\s*2030\s*전용\s*\]?|#?\s*밍글링|#?\s*밍글밍|mingling|\(2030\)\s*$|투어\s*Light\b|#?\s*또래\s*친구\s*만들기|#?\s*여행러버\s*모여라/i

export function isHanatour2030ProductTitle(title: string | null | undefined): boolean {
  return PRODUCT_2030_TITLE_RE.test(String(title ?? ''))
}

/** detail-collect 등 — 정제된 listing title보다 공급사 원제 우선으로 2030 감지. */
export function resolveHanatour2030ProductTitleForDetect(
  ...titles: (string | null | undefined)[]
): string {
  for (const t of titles) {
    const s = String(t ?? '').trim()
    if (s && isHanatour2030ProductTitle(s)) return s
  }
  return String(titles.find((t) => String(t ?? '').trim()) ?? '').trim()
}

export function productHas2030SportsThemeTag(
  sportsThemeTag: string[] | null | undefined,
): boolean {
  if (!Array.isArray(sportsThemeTag) || sportsThemeTag.length === 0) return false
  return sportsThemeTag.some((t) => String(t).trim().toLowerCase() === '2030')
}

/** 등록·공개·관리자·upsert — 아동·유아 슬롯을 쓰지 않는 2030 상품. */
export function isProductAdultOnly2030(product: {
  title?: string | null
  rawTitle?: string | null
  sportsThemeTag?: string[] | null
}): boolean {
  if (productHas2030SportsThemeTag(product.sportsThemeTag)) return true
  return isHanatour2030ProductTitle(
    resolveHanatour2030ProductTitleForDetect(product.rawTitle, product.title),
  )
}

export type AdultOnly2030PriceRowLike = {
  childBed?: number | null
  childNoBed?: number | null
  infant?: number | null
  priceChildWithBed?: number | null
  priceChildNoBed?: number | null
  priceInfant?: number | null
}

/** 공개 요금 행 — 아동·유아 단가를 비운다. */
export function stripAdultOnly2030PriceRowSlots<T extends AdultOnly2030PriceRowLike>(row: T): T {
  return {
    ...row,
    childBed: null,
    childNoBed: null,
    infant: null,
    priceChildWithBed: null,
    priceChildNoBed: null,
    priceInfant: null,
  }
}

export function stripAdultOnly2030PriceRows<T extends AdultOnly2030PriceRowLike>(rows: T[]): T[] {
  return rows.map(stripAdultOnly2030PriceRowSlots)
}
