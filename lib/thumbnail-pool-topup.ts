/**
 * 인기 장소 풀을 10~20장까지 채우는 계획. 이미 10장 이상이면 더 받지 않는다.
 * 받는 순서는 Pexels → Pixabay → Openverse(cc0·pdm). Unsplash·Wikimedia 검색 없음(R03-25·R03-26). 저장 용량은 대표 200KB. 실패하면 그 출처는 SKIP.
 * REGRESSION-FREEZE[thumbnail-least-used-1121]: 장소 풀 10~20 — manifest
 */
import { isSupplierPhotoUrl } from '@/lib/thumbnail-pick'

export const THUMBNAIL_POOL_MIN = 10
export const THUMBNAIL_POOL_MAX = 20
export const THUMBNAIL_TOPUP_PLACES_PER_PROCESS = 8

export function thumbnailPoolFetchCount(have: number): number {
  const n = Math.max(0, Math.floor(have) || 0)
  if (n >= THUMBNAIL_POOL_MIN) return 0
  return THUMBNAIL_POOL_MAX - n
}

export type ThumbnailTopUpCandidate = {
  id: string
  source: string
  url: string
  photographer?: string | null
  originalLink?: string | null
}

export type ThumbnailTopUpResult = { added: number; skipped: string[] }

let placesToppedUp = 0

export function resetThumbnailTopUpCount(): void {
  placesToppedUp = 0
}

export function thumbnailTopUpPlacesUsed(): number {
  return placesToppedUp
}

/** 이 프로세스에서 장소를 더 채울 수 있으면 true 이고 횟수를 하나 쓴다. */
export function claimThumbnailTopUpSlot(): boolean {
  if (placesToppedUp >= THUMBNAIL_TOPUP_PLACES_PER_PROCESS) return false
  placesToppedUp += 1
  return true
}

export async function topUpThumbnailPlacePool(input: {
  have: number
  pause: () => Promise<void>
  search: (tier: 'pexels' | 'pixabay') => Promise<ThumbnailTopUpCandidate[] | Error>
  searchCc0?: () => Promise<ThumbnailTopUpCandidate[] | Error>
  save: (c: ThumbnailTopUpCandidate) => Promise<boolean>
}): Promise<ThumbnailTopUpResult> {
  const need = thumbnailPoolFetchCount(input.have)
  const skipped: string[] = []
  if (need <= 0) return { added: 0, skipped }
  let added = 0
  const seen = new Set<string>()

  const pull = async (tier: string, run: () => Promise<ThumbnailTopUpCandidate[] | Error>) => {
    if (added >= need) return
    await input.pause()
    let batch: ThumbnailTopUpCandidate[] | Error
    try {
      batch = await run()
    } catch (e) {
      batch = e instanceof Error ? e : new Error('search failed')
    }
    if (batch instanceof Error) {
      await input.pause()
      try {
        batch = await run()
      } catch {
        skipped.push(tier)
        return
      }
      if (batch instanceof Error) {
        skipped.push(tier)
        return
      }
    }
    for (const c of batch) {
      if (added >= need) return
      const key = `${c.source}:${c.id}`
      if (!c.url || seen.has(key)) continue
      if (isSupplierPhotoUrl(c.url) || isSupplierPhotoUrl(c.originalLink)) continue
      seen.add(key)
      await input.pause()
      const ok = await input.save(c).catch(() => false)
      if (ok) added += 1
    }
  }

  await pull('pexels', () => input.search('pexels'))
  await pull('pixabay', () => input.search('pixabay'))
  if (input.searchCc0) await pull('cc0', () => input.searchCc0!())
  return { added, skipped }
}
