/**
 * 메가메뉴 browse SSOT 도시 키 — UI leaf + `MegaMenuGroupCardCity`(DB) 합집합.
 * `mega-menu-regions.data.ts` 에 LC-only·카드 전용 도시가 있어 UI만으로는 browse와 태그가 어긋난다.
 */
import type { Prisma } from '@prisma/client'
import {
  buildMegaMenuCityHaystackIndex,
  type MegaMenuCityHaystackIndex,
} from '@/lib/mega-menu-city-haystack-terms'
import { getMegaMenuCityKeys } from '@/lib/mega-menu-master-city-keys'
import { termAppearsInHaystack } from '@/lib/geo-haystack-match'

type SsotCache = {
  cityKeys: Set<string>
  termIndex: MegaMenuCityHaystackIndex['termIndex']
}

let cached: SsotCache | null = null

async function loadCardOnlyCityMeta(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  uiKeys: Set<string>,
): Promise<Array<{ cityKey: string; terms: string[] }>> {
  const rows = await db.megaMenuGroupCardCity.findMany({
    where: { card: { isActive: true } },
    select: { cityKey: true },
    distinct: ['cityKey'],
  })
  const extraKeys = rows.map((r) => r.cityKey).filter((k) => k && !uiKeys.has(k))
  if (extraKeys.length === 0) return []

  const cities = await db.city.findMany({
    where: { cityKey: { in: extraKeys }, isActive: true },
    select: { cityKey: true, koreanLabel: true },
  })

  return cities.map((c) => ({
    cityKey: c.cityKey,
    terms: [c.koreanLabel, c.cityKey].map((t) => t.trim()).filter(Boolean),
  }))
}

/** UI + DB 카드 도시 키 (browse `resolveBrowseCardKeyToCityKeys` 와 동일 집합) */
export async function loadMegaMenuSsotCityKeys(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
): Promise<Set<string>> {
  const built = await loadMegaMenuSsotHaystackIndex(db)
  return built.cityKeys
}

export async function loadMegaMenuSsotHaystackIndex(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
): Promise<MegaMenuCityHaystackIndex> {
  if (cached) return { cityKeys: cached.cityKeys, termIndex: cached.termIndex }

  const ui = buildMegaMenuCityHaystackIndex()
  const cardOnly = await loadCardOnlyCityMeta(db, ui.cityKeys)
  const cityKeys = new Set(ui.cityKeys)
  const termIndex = [...ui.termIndex]
  for (const { cityKey, terms } of cardOnly) {
    cityKeys.add(cityKey)
    termIndex.push({ cityKey, terms })
  }

  cached = { cityKeys, termIndex }
  return { cityKeys, termIndex }
}

/** 프로세스 내 캐시 무효화 (테스트·장시간 스크립트) */
export function resetMegaMenuSsotCityKeysCache(): void {
  cached = null
}

export async function matchMegaMenuSsotCityKeysInHaystack(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  haystack: string,
): Promise<string[]> {
  const h = haystack.trim()
  if (!h) return []
  const { cityKeys, termIndex } = await loadMegaMenuSsotHaystackIndex(db)
  const out = new Set<string>()
  for (const { cityKey, terms } of termIndex) {
    if (!cityKeys.has(cityKey)) continue
    for (const term of terms) {
      if (term.trim().length < 2) continue
      if (termAppearsInHaystack(term, h)) {
        out.add(cityKey)
        break
      }
    }
  }
  return [...out]
}

export async function isMegaMenuSsotCityKey(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  cityKey: string | null | undefined,
): Promise<boolean> {
  const k = (cityKey ?? '').trim()
  if (!k) return false
  const keys = await loadMegaMenuSsotCityKeys(db)
  return keys.has(k)
}

/** 동기 UI-only 집합 (레거시·테스트) */
export function getMegaMenuUiCityKeys(): Set<string> {
  return getMegaMenuCityKeys()
}
