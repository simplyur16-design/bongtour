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
const PREVIEW_TTL_MS = 5 * 60 * 1000

function storageKey(pathSegment: string): string {
  return `${STORAGE_PREFIX}${pathSegment}`
}

/** `/products/{idOrSlug}` path segment — query 제외 */
export function detailPathSegmentFromHref(href: string): string | null {
  const raw = href.trim()
  if (!raw) return null
  try {
    const pathname = raw.startsWith('http') ? new URL(raw).pathname : raw.split('?')[0]?.split('#')[0] ?? ''
    const parts = pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'products')
    const seg = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1]
    const trimmed = seg?.trim()
    return trimmed || null
  } catch {
    return null
  }
}

function storageKeysForSegments(productId: string, href: string): string[] {
  const segments = new Set<string>()
  if (productId.trim()) segments.add(productId.trim())
  const fromHref = detailPathSegmentFromHref(href)
  if (fromHref) segments.add(fromHref)
  return [...segments].map(storageKey)
}

function storageKeysForPreview(preview: ProductDetailCardPreview): string[] {
  return storageKeysForSegments(preview.id, preview.href)
}

function parseStoredPreview(raw: string): ProductDetailCardPreview | null {
  try {
    const parsed = JSON.parse(raw) as ProductDetailCardPreview
    if (!parsed?.id?.trim()) return null
    if (Date.now() - (parsed.savedAt ?? 0) > PREVIEW_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProductDetailCardPreview(preview: ProductDetailCardPreview): void {
  if (typeof window === 'undefined') return
  const payload: ProductDetailCardPreview = { ...preview, savedAt: Date.now() }
  const json = JSON.stringify(payload)
  try {
    for (const key of storageKeysForPreview(payload)) {
      sessionStorage.setItem(key, json)
    }
  } catch {
    /* quota / private mode */
  }
}

/** URL segment(id 또는 slug)로 조회 — id·slug 키 모두 저장된 경우 동일 payload */
export function readProductDetailCardPreview(pathSegment: string): ProductDetailCardPreview | null {
  if (typeof window === 'undefined') return null
  const segment = pathSegment.trim()
  if (!segment) return null
  try {
    const raw = sessionStorage.getItem(storageKey(segment))
    if (!raw) return null
    const parsed = parseStoredPreview(raw)
    if (!parsed) {
      sessionStorage.removeItem(storageKey(segment))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearProductDetailCardPreview(pathSegmentOrId: string): void {
  if (typeof window === 'undefined') return
  const segment = pathSegmentOrId.trim()
  if (!segment) return
  try {
    sessionStorage.removeItem(storageKey(segment))
  } catch {
    /* ignore */
  }
}

/** 서버 본문 표시 후 — id·href segment 키 모두 제거 */
export function clearProductDetailCardPreviewFor(preview: Pick<ProductDetailCardPreview, 'id' | 'href'>): void {
  if (typeof window === 'undefined') return
  const keys = new Set(storageKeysForSegments(preview.id, preview.href))
  try {
    for (const key of keys) {
      sessionStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

/** URL path segment — browse 카드는 `/products/{id|slug}` 기준 */
export function productIdFromDetailPathSegment(segment: string): string {
  return segment.trim()
}
