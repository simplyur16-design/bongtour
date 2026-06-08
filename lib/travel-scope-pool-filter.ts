import type { Prisma } from '@prisma/client'
import { parseTravelScope } from '@/lib/product-listing-kind'

/**
 * 공개 browse — URL `scope=domestic|overseas` 와 Product.travelScope 를 맞출 때 사용.
 * travelScope 미설정(null)은 기존 제목 기반 트리아지와 병행(fallback).
 */
/**
 * browse `findMany` — `filterPoolByStoredTravelScope`와 동일 규칙.
 * `overseas`: travelScope='overseas' + 미설정(null·'') — 후단 `filterProductsForOverseasDestinationTree`로 국내 제외.
 * `domestic`: travelScope 미설정(null·'')은 domestic 풀에 포함(기존).
 */
export function prismaWhereForBrowseTravelScope(
  scopeParam: string | null | undefined,
): Prisma.ProductWhereInput | null {
  const s = (scopeParam ?? '').trim().toLowerCase()
  if (s === 'overseas') {
    return { OR: [{ travelScope: 'overseas' }, { travelScope: null }, { travelScope: '' }] }
  }
  if (s === 'domestic') {
    return { OR: [{ travelScope: 'domestic' }, { travelScope: null }, { travelScope: '' }] }
  }
  return null
}

export function filterPoolByStoredTravelScope<T extends { travelScope?: string | null }>(
  products: T[],
  scopeParam: string | null
): T[] {
  if (scopeParam !== 'domestic' && scopeParam !== 'overseas') return products
  return products.filter((p) => {
    const ts = parseTravelScope(p.travelScope ?? undefined)
    if (scopeParam === 'overseas') return ts !== 'domestic'
    if (ts == null) return true
    return ts !== 'overseas'
  })
}
