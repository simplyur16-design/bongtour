import { parseTravelScope } from '@/lib/product-listing-kind'

/**
 * 공개 browse — URL `scope=domestic|overseas` 와 Product.travelScope 를 맞출 때 사용.
 * travelScope 미설정(null)은 기존 제목 기반 트리아지와 병행(fallback).
 */
export function filterPoolByStoredTravelScope<T extends { travelScope?: string | null }>(
  products: T[],
  scopeParam: string | null
): T[] {
  if (scopeParam !== 'domestic' && scopeParam !== 'overseas') return products
  return products.filter((p) => {
    const ts = parseTravelScope(p.travelScope ?? undefined)
    if (ts == null) return true
    if (scopeParam === 'overseas') return ts !== 'domestic'
    return ts !== 'overseas'
  })
}
