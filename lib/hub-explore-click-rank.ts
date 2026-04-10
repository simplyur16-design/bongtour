export const HUB_EXPLORE_CLICK_RANK_LS_KEY = 'bt:hub-explore-click-rank:v1' as const

const STORAGE_KEY = HUB_EXPLORE_CLICK_RANK_LS_KEY

export function domesticAreaRankKey(groupKey: string, areaKey: string): string {
  return `dm:area:${groupKey}:${areaKey}`
}

export function overseasCountryRankKey(groupKey: string, countryKey: string): string {
  return `os:country:${groupKey}:${countryKey}`
}

export function readHubExploreClickMap(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n > 0) out[k] = Math.min(Math.floor(n), 1_000_000)
    }
    return out
  } catch {
    return {}
  }
}

export function bumpHubExploreClick(id: string): void {
  if (typeof window === 'undefined' || !id) return
  try {
    const map = readHubExploreClickMap()
    const next = (map[id] ?? 0) + 1
    map[id] = Math.min(next, 1_000_000)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // quota / private mode
  }
}
