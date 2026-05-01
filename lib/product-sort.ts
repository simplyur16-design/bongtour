// TODO: 고객 데이터 쌓이면 bongsim_order에서 최근 30일 주문 수 기준 인기순으로 전환

/** 월별 추천 여행지(문자열 포함 매칭용) — 상단 고정 3개 순서 */
export const SEASONAL_PICKS: Record<string, string[]> = {
  '1': ['일본', '괌', '사이판'],
  '2': ['일본', '괌', '베트남'],
  '3': ['일본', '대만', '베트남'],
  '4': ['일본', '대만', '태국'],
  '5': ['유럽', '일본', '괌'],
  '6': ['유럽', '발리', '태국'],
  '7': ['유럽', '괌', '사이판'],
  '8': ['유럽', '괌', '사이판'],
  '9': ['일본', '대만', '베트남'],
  '10': ['일본', '대만', '홍콩'],
  '11': ['일본', '베트남', '태국'],
  '12': ['괌', '사이판', '베트남'],
}

export type SeasonSortableProduct = {
  id: string
  title: string
  primaryDestination: string | null
  primaryRegion?: string | null
  countryRowLabel?: string | null
}

function yyyymmddNumber(d: Date): number {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return y * 10000 + m * 100 + day
}

/** 시드 + id — 같은 날·같은 목록에서 안정적인 순서 */
function dailyOrderKey(seed: number, id: string): number {
  let h = seed ^ 0x9e3779b9
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i)
  }
  return h >>> 0
}

function matchHaystack(p: SeasonSortableProduct): string {
  return [p.title, p.primaryDestination ?? '', p.primaryRegion ?? '', p.countryRowLabel ?? ''].join('\0')
}

/** picks 중 가장 앞선(우선순위 높은) 키워드 인덱스, 없으면 null */
function bestPickIndex(picks: readonly string[], text: string): number | null {
  let best: number | null = null
  for (let i = 0; i < picks.length; i++) {
    if (text.includes(picks[i]!)) {
      if (best === null || i < best) best = i
    }
  }
  return best
}

export type SortProductsBySeasonResult<T extends SeasonSortableProduct> = {
  items: T[]
  seasonalPickIds: Set<string>
}

/**
 * - 이번 달 시즌 키워드에 맞는 상품을 상단에(키워드 배열 순서)
 * - 나머지는 YYYYMMDD 숫자 시드 기반 해시로 일 단위 셔플
 */
export function sortProductsBySeason<T extends SeasonSortableProduct>(
  products: readonly T[],
  currentMonth: number,
  options?: { dateSeed?: Date }
): SortProductsBySeasonResult<T> {
  const m = Math.min(12, Math.max(1, Math.floor(currentMonth)))
  const picks = SEASONAL_PICKS[String(m)] ?? SEASONAL_PICKS['1']!
  const seed = yyyymmddNumber(options?.dateSeed ?? new Date())
  const seasonalPickIds = new Set<string>()

  const decorated = products.map((item) => {
    const pickIdx = bestPickIndex(picks, matchHaystack(item))
    if (pickIdx !== null) seasonalPickIds.add(item.id)
    const orderKey = dailyOrderKey(seed, item.id)
    return { item, pickIdx, orderKey }
  })

  decorated.sort((a, b) => {
    const aSeason = a.pickIdx !== null ? 0 : 1
    const bSeason = b.pickIdx !== null ? 0 : 1
    if (aSeason !== bSeason) return aSeason - bSeason
    if (a.pickIdx !== null && b.pickIdx !== null && a.pickIdx !== b.pickIdx) {
      return a.pickIdx - b.pickIdx
    }
    return a.orderKey - b.orderKey
  })

  return {
    items: decorated.map((x) => x.item),
    seasonalPickIds,
  }
}
