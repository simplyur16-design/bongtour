/** 목록 카드 → 상세 전환 시 sessionStorage에 넣는 즉시 껍데기 데이터 */
export type ProductDetailCardPreview = {
  id: string
  title: string
  originSource: string
  primaryDestination: string | null
  duration: string | null
  imageUrl: string | null
  priceKrw: number | null
  priceLabel?: string | null
  href: string
  savedAt: number
}

const STORAGE_PREFIX = 'bongtour:product-detail-preview:'

function storageKey(productId: string): string {
  return `${STORAGE_PREFIX}${productId}`
}

export function saveProductDetailCardPreview(preview: ProductDetailCardPreview): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(preview.id), JSON.stringify(preview))
  } catch {
    /* quota / private mode */
  }
}

export function readProductDetailCardPreview(productId: string): ProductDetailCardPreview | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(productId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProductDetailCardPreview
    if (!parsed?.id || parsed.id !== productId) return null
    if (Date.now() - (parsed.savedAt ?? 0) > 5 * 60 * 1000) {
      sessionStorage.removeItem(storageKey(productId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearProductDetailCardPreview(productId: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(productId))
  } catch {
    /* ignore */
  }
}

/** URL path segment — browse 카드는 `/products/{id}` 기준 */
export function productIdFromDetailPathSegment(segment: string): string {
  return segment.trim()
}
