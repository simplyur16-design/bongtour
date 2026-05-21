import { trainingProgramPublicPath } from '@/lib/overseas-training-program-query'

export const MYPAGE_WISHLIST_STORAGE_KEY = 'bongtour:mypage-wishlist'

export type MypageWishlistKind = 'product' | 'training'

export type MypageWishlistItem = {
  kind: MypageWishlistKind
  productId: string
  title: string
  slug: string | null
  destination: string | null
  savedAt: string
}

export function wishlistItemKey(kind: MypageWishlistKind, id: string): string {
  return `${kind}:${id}`
}

export function readMypageWishlist(): MypageWishlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MYPAGE_WISHLIST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x): MypageWishlistItem | null => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const productId = typeof o.productId === 'string' ? o.productId : ''
        const title = typeof o.title === 'string' ? o.title : ''
        if (!productId || !title) return null
        const kind: MypageWishlistKind =
          o.kind === 'training' ? 'training' : 'product'
        return {
          kind,
          productId,
          title,
          slug: typeof o.slug === 'string' ? o.slug : null,
          destination: typeof o.destination === 'string' ? o.destination : null,
          savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date().toISOString(),
        }
      })
      .filter((x): x is MypageWishlistItem => x !== null)
      .slice(0, 100)
  } catch {
    return []
  }
}

export function writeMypageWishlist(items: MypageWishlistItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MYPAGE_WISHLIST_STORAGE_KEY, JSON.stringify(items.slice(0, 100)))
}

export function isInMypageWishlist(kind: MypageWishlistKind, id: string): boolean {
  const key = wishlistItemKey(kind, id)
  return readMypageWishlist().some((x) => wishlistItemKey(x.kind, x.productId) === key)
}

export function toggleMypageWishlist(input: Omit<MypageWishlistItem, 'savedAt'>): boolean {
  const key = wishlistItemKey(input.kind, input.productId)
  const list = readMypageWishlist()
  const idx = list.findIndex((x) => wishlistItemKey(x.kind, x.productId) === key)
  if (idx >= 0) {
    list.splice(idx, 1)
    writeMypageWishlist(list)
    return false
  }
  list.unshift({ ...input, savedAt: new Date().toISOString() })
  writeMypageWishlist(list)
  return true
}

export function productHref(item: MypageWishlistItem): string {
  if (item.kind === 'training') {
    return trainingProgramPublicPath({ id: item.productId, slug: item.slug })
  }
  if (item.slug?.trim()) return `/products/${item.slug.trim()}`
  return `/products/${item.productId}`
}
