/**
 * ProductCityTag SSOT — browse·메가메뉴 도시/열(`menuGroup`) 필터.
 * 다도시 클러스터는 구성 도시 전부(메가메뉴에 있는 도시만) 태그로 연결한다.
 */
import type { Prisma } from '@prisma/client'
import { clusterCityKeysForNode, isClusterExpansionNode } from '@/lib/cluster-city-expansions'
import { filterCityKeysToCoherentMegaMenuGroup } from '@/lib/mega-menu-city-group-coherence'
import {
  isMegaMenuSsotCityKey,
  loadMegaMenuSsotCityKeys,
  matchMegaMenuSsotCityKeysInHaystack,
} from '@/lib/mega-menu-ssot-city-keys'
import { isMultiCityClusterNode } from '@/lib/product-master-mapping'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'

export type SyncProductCityTagsOpts = {
  title?: string
  primaryDestination?: string | null
  destinationRaw?: string | null
  /** 일정 title·description·routeText — 메가메뉴 도시 토큰 매칭용 */
  scheduleHaystack?: string | null
}

function clusterNodeKeyFromGeo(geo: ProductLocationKeyPrismaFields): string | null {
  const nk = geo.nodeKey?.trim()
  if (nk && isClusterExpansionNode(nk)) return nk
  const ck = geo.cityKey?.trim()
  if (ck && isClusterExpansionNode(ck)) return ck
  return null
}

async function resolveSingleMegaMenuCityKey(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  geo: ProductLocationKeyPrismaFields,
): Promise<string | null> {
  let cityKey = geo.cityKey?.trim() || null
  if (cityKey && isMultiCityClusterNode(cityKey)) return null

  if (!cityKey) {
    const nk = geo.nodeKey?.trim()
    if (nk && !isMultiCityClusterNode(nk)) {
      const byNode = await db.city.findUnique({ where: { cityKey: nk }, select: { cityKey: true } })
      if (byNode) cityKey = nk
    }
  }

  if (!cityKey || !(await isMegaMenuSsotCityKey(db, cityKey))) return null
  const row = await db.city.findUnique({ where: { cityKey }, select: { cityKey: true } })
  return row ? cityKey : null
}

async function filterCityKeysInMaster(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  keys: Iterable<string>,
): Promise<string[]> {
  const mega = await loadMegaMenuSsotCityKeys(db)
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const raw of keys) {
    const k = raw.trim()
    if (!k || seen.has(k) || !mega.has(k)) continue
    const row = await db.city.findUnique({ where: { cityKey: k }, select: { cityKey: true } })
    if (!row) continue
    seen.add(k)
    ordered.push(k)
  }
  return ordered
}

/**
 * 클러스터 펼침 + 단일 도시 + 제목·목적지 토큰(메가메뉴 도시만).
 */
export async function resolveProductCityKeysForTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  geo: ProductLocationKeyPrismaFields,
  opts?: SyncProductCityTagsOpts,
): Promise<string[]> {
  const candidates: string[] = []

  const clusterNode = clusterNodeKeyFromGeo(geo)
  if (clusterNode) {
    candidates.push(...clusterCityKeysForNode(clusterNode))
  }

  const single = await resolveSingleMegaMenuCityKey(db, geo)
  if (single) candidates.push(single)

  if (opts) {
    const haystack = [opts.title, opts.primaryDestination, opts.destinationRaw, opts.scheduleHaystack]
      .filter((x): x is string => Boolean(x && String(x).trim()))
      .join(' ')
    if (haystack) {
      candidates.push(...(await matchMegaMenuSsotCityKeysInHaystack(db, haystack)))
    }
  }

  let filtered = await filterCityKeysInMaster(db, candidates)
  const primaryGeo = geo.cityKey?.trim() || geo.nodeKey?.trim() || null
  if (primaryGeo && filtered.length > 1) {
    filtered = filterCityKeysToCoherentMegaMenuGroup(primaryGeo, filtered)
  }
  if (primaryGeo && filtered.includes(primaryGeo) && filtered.length > 1) {
    const rest = filtered.filter((k) => k !== primaryGeo)
    return [primaryGeo, ...rest]
  }
  if (primaryGeo && filtered.length === 0 && (await isMegaMenuSsotCityKey(db, primaryGeo))) {
    const row = await db.city.findUnique({ where: { cityKey: primaryGeo }, select: { cityKey: true } })
    if (row) return [primaryGeo]
  }
  return filtered
}

/**
 * 상품 1건 ProductCityTag 동기화 — 기존 도시 태그 전부 교체.
 */
export async function syncProductCityTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts?: SyncProductCityTagsOpts,
): Promise<{ tagCount: number; cityKeys: string[]; cityKey: string | null }> {
  await db.productCityTag.deleteMany({ where: { productId } })

  const cityKeys = await resolveProductCityKeysForTags(db, geo, opts)
  if (cityKeys.length === 0) {
    return { tagCount: 0, cityKeys: [], cityKey: null }
  }

  const primaryFromGeo = geo.cityKey?.trim()
  const primaryCityKey =
    primaryFromGeo && cityKeys.includes(primaryFromGeo)
      ? primaryFromGeo
      : cityKeys[0]!

  await db.productCityTag.createMany({
    data: cityKeys.map((cityKey, i) => ({
      productId,
      cityKey,
      isPrimary: cityKey === primaryCityKey,
      sortOrder: i,
    })),
  })

  return { tagCount: cityKeys.length, cityKeys, cityKey: primaryCityKey }
}
