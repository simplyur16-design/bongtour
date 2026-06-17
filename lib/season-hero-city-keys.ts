/**
 * 시즌 히어로(메인·해외 허브) — cityKey/fallbackKeys 도시별 hero-eligible 상품 검증·교체 SSOT.
 * 조건: registered + travelScope='overseas' + 메가메뉴 browse geo 일치 + bgImageUrl 존재.
 */
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { productMatchesBrowseUrlGeo, type OverseasProductMatchInput } from '@/lib/match-overseas-product'
import { loadMegaMenuBrowseUrlGeoByCityKeys } from '@/lib/mega-menu-city-browse-href'
import type { BrowseUrlGeo } from '@/lib/match-overseas-product'

export type HeroCityKeyReplacement = { from: string; to: string }

function uniqPreserveOrder(keys: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of keys) {
    const t = String(k).trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export type HeroEligibleCityKeyResult = {
  eligible: Set<string>
  /** pool 전체에 대한 megaMenu browse geo — resolved subset 재사용용 */
  browseGeoByCity: Map<string, BrowseUrlGeo>
}

/** 풀 내 도시 중 hero-eligible(등록·해외·메가메뉴 browse·bgImageUrl) cityKey 집합 */
export async function loadHeroEligibleCityKeySet(
  poolKeys: string[],
  now = new Date(),
): Promise<HeroEligibleCityKeyResult> {
  const pool = uniqPreserveOrder(poolKeys)
  if (pool.length === 0) return { eligible: new Set(), browseGeoByCity: new Map() }

  const browseGeoByCity = await loadMegaMenuBrowseUrlGeoByCityKeys(pool)

  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      bgImageUrl: { not: null },
      AND: [
        publicProductWhereClause(now),
        {
          OR: [{ cityKey: { in: pool } }, { cityTags: { some: { cityKey: { in: pool } } } }],
        },
      ],
    },
    select: {
      bgImageUrl: true,
      cityKey: true,
      cityTags: { select: { cityKey: true } },
      countryTags: { select: { countryKey: true, nodeKey: true } },
    },
  })

  const products: OverseasProductMatchInput[] = rows
    .filter((p) => p.bgImageUrl?.trim())
    .map((p) => ({
      title: '',
      originSource: '',
      cityKey: p.cityKey,
      cityTags: p.cityTags,
      countryTags: p.countryTags,
    }))

  const eligible = new Set<string>()
  for (const cityKey of pool) {
    const geo = browseGeoByCity.get(cityKey)
    if (!geo) continue
    if (products.some((p) => productMatchesBrowseUrlGeo(p, geo))) eligible.add(cityKey)
  }
  return { eligible, browseGeoByCity }
}

/**
 * primary 순서 유지 — 상품 없는 슬롯은 fallbackKeys에서 순차 교체(미사용·eligible만).
 */
export function resolveHeroCityKeysWithProductFallback(
  primaryKeys: string[],
  fallbackKeys: string[],
  eligible: Set<string>,
  targetCount = 5,
): { resolved: string[]; replacements: HeroCityKeyReplacement[] } {
  const primary = uniqPreserveOrder(primaryKeys).slice(0, targetCount)
  const fallback = uniqPreserveOrder(fallbackKeys)
  const used = new Set<string>()
  const resolved: string[] = []
  const replacements: HeroCityKeyReplacement[] = []

  let fallbackIdx = 0
  const takeNextFallback = (): string | null => {
    while (fallbackIdx < fallback.length) {
      const k = fallback[fallbackIdx]!
      fallbackIdx += 1
      if (used.has(k) || !eligible.has(k)) continue
      return k
    }
    return null
  }

  for (const key of primary) {
    if (resolved.length >= targetCount) break
    if (eligible.has(key) && !used.has(key)) {
      resolved.push(key)
      used.add(key)
      continue
    }
    const rep = takeNextFallback()
    if (rep) {
      resolved.push(rep)
      used.add(rep)
      replacements.push({ from: key, to: rep })
    }
  }

  while (resolved.length < targetCount) {
    const rep = takeNextFallback()
    if (!rep) break
    resolved.push(rep)
    used.add(rep)
  }

  return { resolved: resolved.slice(0, targetCount), replacements }
}

export function logHeroCityKeyReplacements(replacements: HeroCityKeyReplacement[], logPrefix: string): void {
  for (const { from, to } of replacements) {
    console.log(`${logPrefix} ${from} → ${to}`)
  }
}
