/** SSR 요청마다 새 시드 — 새로고침 시 대표(큰) 카드 로테이션 */
export function createHubGalleryRotationSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

function mixSeed(seed: number, scopeKey: string): number {
  let h = seed >>> 0
  for (let i = 0; i < scopeKey.length; i++) {
    h = (Math.imul(31, h) + scopeKey.charCodeAt(i)!) >>> 0
  }
  return h
}

export function pickRotatingFeaturedIndex<T>(items: readonly T[], seed: number, scopeKey: string): number {
  if (items.length === 0) return 0
  return mixSeed(seed, scopeKey) % items.length
}

export const HUB_HERO_SMALL_CARD_COUNT = 4

export function splitHeroPlusSmall<T extends { id: string }>(
  items: readonly T[],
  seed: number,
  scopeKey: string,
): { featured: T | null; previewSmall: T[]; overflow: T[] } {
  if (items.length === 0) {
    return { featured: null, previewSmall: [], overflow: [] }
  }
  const idx = pickRotatingFeaturedIndex(items, seed, scopeKey)
  const featured = items[idx]!
  const others = items.filter((it) => it.id !== featured.id)
  return {
    featured,
    previewSmall: others.slice(0, HUB_HERO_SMALL_CARD_COUNT),
    overflow: others.slice(HUB_HERO_SMALL_CARD_COUNT),
  }
}
