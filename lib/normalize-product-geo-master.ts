/**
 * I-6: 트리 키 → 마스터 Continent/Country/City 정합 + 보수적 다국가 자동 태그.
 */
import type { Prisma } from '@prisma/client'
import { resolveProductCityToKoreanDisplay, resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import { BROWSE_SLUG_PREFER_TREE_KR_LABEL, koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { buildMultiCountryDetectionHaystack, termAppearsInHaystack } from '@/lib/geo-haystack-match'
import { matchMegaMenuSsotCityKeysInHaystack } from '@/lib/mega-menu-ssot-city-keys'
import {
  findGroupKeyForCountryKey,
  matchTokensForCountryShallow,
  matchTokensForLeaf,
  OVERSEAS_LOCATION_TREE_CLEAN,
} from '@/lib/overseas-location-tree'
import {
  isMultiCityClusterNode,
  mapTreeKeysToMasterKeys,
  masterCountryKeyFromLatinCaribbeanSouthAmericaTerm,
  type MapTreeKeysInput,
  type MapTreeKeysResult,
} from '@/lib/product-master-mapping'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

/** `mapTreeKeysToMaster` 명세 — I-3 `mapTreeKeysToMasterKeys` 별칭 */
export function mapTreeKeysToMaster(input: MapTreeKeysInput): MapTreeKeysResult {
  return mapTreeKeysToMasterKeys(input)
}

function fallbackBrowseKoreanLabels(d: ProductLocationKeyPrismaFields): {
  country: string | null
  city: string | null
} {
  const slugForKr = (d.countryKey ?? d.country ?? '').trim().toLowerCase()
  const fromResolve =
    resolveProductCountryToKoreanDisplay(d.country) ??
    resolveProductCountryToKoreanDisplay(d.countryKey)
  const treeLabelOverride =
    slugForKr && BROWSE_SLUG_PREFER_TREE_KR_LABEL.has(slugForKr)
      ? koreanCountryLabelFromBrowseSlug(slugForKr)
      : null
  const country = treeLabelOverride ?? fromResolve ?? d.country
  const city = resolveProductCityToKoreanDisplay(d.city) ?? d.city
  return { country, city }
}

export type EnrichPrismaGeoDestinationContext = {
  primaryDestination?: string | null
  title?: string | null
}

/** cuba-mexico leaf — browse city slug(`cuba`) 오염 방지; 상품 목적지·제목 우선 */
function destinationHintForMasterMapping(
  d: ProductLocationKeyPrismaFields,
  ctx?: EnrichPrismaGeoDestinationContext,
): string | null {
  const parts = [ctx?.primaryDestination, ctx?.title, d.country]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' ').trim() : null
}

/**
 * D-3 트리 추론 결과에 마스터 라벨·FK(continentKey/cityKey)·canonical countryKey 보강.
 */
export async function enrichPrismaGeoWithMasterLabels(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  d: ProductLocationKeyPrismaFields,
  ctx?: EnrichPrismaGeoDestinationContext,
): Promise<ProductLocationKeyPrismaFields> {
  const mapped = mapTreeKeysToMasterKeys({
    groupKey: d.groupKey,
    countryKey: d.countryKey,
    nodeKey: d.nodeKey,
    destinationHint: destinationHintForMasterMapping(d, ctx),
  })

  if (!mapped.masterCountryKey) {
    const { country, city } = fallbackBrowseKoreanLabels(d)
    return {
      ...d,
      continentKey: null,
      cityKey: null,
      country,
      city,
    }
  }

  const countryRow = await db.country.findFirst({
    where: { countryKey: mapped.masterCountryKey, isActive: true },
    select: { countryKey: true, continentKey: true, koreanLabel: true },
  })

  if (!countryRow) {
    const { country, city } = fallbackBrowseKoreanLabels(d)
    return {
      ...d,
      continentKey: null,
      cityKey: null,
      countryKey: mapped.masterCountryKey,
      country,
      city,
    }
  }

  let cityKey: string | null = null
  let cityKr: string | null = null
  const nk = mapped.cityKey
  if (nk && !isMultiCityClusterNode(nk)) {
    const cityRow = await db.city.findFirst({
      where: {
        cityKey: nk,
        countryKey: mapped.masterCountryKey,
        isActive: true,
      },
      select: { cityKey: true, koreanLabel: true },
    })
    if (cityRow) {
      cityKey = cityRow.cityKey
      cityKr = cityRow.koreanLabel
    }
  }

  const gk = d.groupKey ?? findGroupKeyForCountryKey(mapped.masterCountryKey) ?? ''
  const continent = gk ? continentTabIdForMatch(gk, mapped.masterCountryKey) : d.continent

  return {
    ...d,
    countryKey: mapped.masterCountryKey,
    groupKey: d.groupKey,
    nodeKey: d.nodeKey,
    continent,
    continentKey: countryRow.continentKey,
    cityKey,
    country: countryRow.koreanLabel,
    city: cityKr,
  }
}

export type MultiCountryAutoPlan =
  | { kind: 'none' }
  | {
      kind: 'multi'
      confidence: 'high' | 'medium' | 'low'
      countryKeys: string[]
      declaredN: number
    }

export function declaredCountryCountFromTitle(title: string): number | null {
  const t = title.trim()
  const m1 = t.match(/(\d+)\s*개국/)
  if (m1) return Math.min(Math.max(2, parseInt(m1[1]!, 10)), 24)
  const m2 = t.match(/(\d+)\s*국(?:\s|패키지|연계|일주|순회|투어|$)/)
  if (m2) return Math.min(Math.max(2, parseInt(m2[1]!, 10)), 24)
  return null
}

/**
 * 제목의 N국·N개국 + 목적지 문자열에 등장하는 Country.koreanLabel 매칭(보수적).
 */
function collectMasterCountryKeysFromTreeTokens(hay: string): string[] {
  const keys: string[] = []
  const used = new Set<string>()
  for (const group of OVERSEAS_LOCATION_TREE_CLEAN) {
    for (const country of group.countries) {
      const tryToken = (term: string, nodeKey: string) => {
        const t = term.trim()
        if (t.length < 2) return
        if (!termAppearsInHaystack(t, hay)) return
        const mapped = mapTreeKeysToMasterKeys({
          groupKey: group.groupKey,
          countryKey: country.countryKey,
          nodeKey,
        })
        let mk = mapped.masterCountryKey?.trim() || null
        // REGRESSION-FREEZE[mega-menu-product-alignment]: latin-caribbean south-america alias → master — manifest
        if (
          !mk &&
          country.countryKey === 'latin-caribbean' &&
          nodeKey === 'south-america'
        ) {
          mk = masterCountryKeyFromLatinCaribbeanSouthAmericaTerm(t)
        }
        if (!mk || used.has(mk)) return
        used.add(mk)
        keys.push(mk)
      }
      for (const term of matchTokensForCountryShallow(country)) {
        tryToken(term, country.countryKey)
      }
      for (const leaf of country.children) {
        for (const term of matchTokensForLeaf(country, leaf)) {
          tryToken(term, leaf.nodeKey)
        }
      }
    }
  }
  return keys
}

/** 일정·제목에만 도시명(리마·라파즈·이과수)이 있을 때 중남미 마스터 국가 보강 */
function collectLatinAmericaMasterCountryKeysFromPlaceHints(hay: string): string[] {
  const out: string[] = []
  const used = new Set<string>()
  const push = (ck: string) => {
    if (used.has(ck)) return
    used.add(ck)
    out.push(ck)
  }
  if (/리마|쿠스코|마추\s*픽추|페루|\bLima\b|\bCusco\b|\bMachu\b/i.test(hay)) push('peru')
  if (/우유니|라파즈|라파스|볼리비아|\bUyuni\b|La\s*Paz/i.test(hay)) push('bolivia')
  if (/리오\s*데\s*자|리우\s*데\s*자|브라질|Rio\s*de\s*Janeiro/i.test(hay)) push('brazil')
  if (/이과수|아르헨|부에노스|Iguazu|Buenos\s*Aires/i.test(hay)) push('argentina')
  if (/산티아고|칠레|\bChile\b|\bSantiago\b/i.test(hay)) push('chile')
  return out
}

export async function detectMultiCountryAutoPlan(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  opts: {
    title: string
    primaryDestination: string | null
    destinationRaw: string | null
    scheduleHaystack?: string | null
  },
  primaryMasterCountryKey: string | null,
): Promise<MultiCountryAutoPlan> {
  const title = opts.title.trim()
  const nDeclared = declaredCountryCountFromTitle(title)

  const hay = buildMultiCountryDetectionHaystack(opts)
  if (!hay.trim()) {
    if (nDeclared) return { kind: 'multi', confidence: 'low', countryKeys: [], declaredN: nDeclared }
    return { kind: 'none' }
  }

  const countries = await db.country.findMany({
    where: { isActive: true },
    select: { countryKey: true, koreanLabel: true },
  })
  const sorted = [...countries].sort((a, b) => b.koreanLabel.length - a.koreanLabel.length)

  const foundKeys: string[] = []
  const used = new Set<string>()
  for (const c of sorted) {
    const label = c.koreanLabel.trim()
    if (label.length < 2) continue
    if (termAppearsInHaystack(label, hay) && !used.has(c.countryKey)) {
      foundKeys.push(c.countryKey)
      used.add(c.countryKey)
    }
  }

  for (const mk of collectMasterCountryKeysFromTreeTokens(hay)) {
    if (!used.has(mk)) {
      foundKeys.push(mk)
      used.add(mk)
    }
  }
  for (const mk of collectLatinAmericaMasterCountryKeysFromPlaceHints(hay)) {
    if (!used.has(mk)) {
      foundKeys.push(mk)
      used.add(mk)
    }
  }

  const megaCityKeys = await matchMegaMenuSsotCityKeysInHaystack(db, hay)
  if (megaCityKeys.length > 0) {
    const cities = await db.city.findMany({
      where: { cityKey: { in: megaCityKeys }, isActive: true },
      select: { countryKey: true },
    })
    for (const c of cities) {
      if (!used.has(c.countryKey)) {
        foundKeys.push(c.countryKey)
        used.add(c.countryKey)
      }
    }
  }

  const labelIndex = (countryKey: string) => {
    const label = countries.find((x) => x.countryKey === countryKey)?.koreanLabel ?? ''
    const i = label ? hay.indexOf(label) : -1
    return i === -1 ? 99999 : i
  }
  foundKeys.sort((a, b) => labelIndex(a) - labelIndex(b))

  const declaredN = nDeclared ?? (foundKeys.length >= 2 ? foundKeys.length : 0)

  if (foundKeys.length < 2) {
    if (nDeclared && foundKeys.length > 0) {
      return { kind: 'multi', confidence: 'low', countryKeys: foundKeys, declaredN: nDeclared }
    }
    return { kind: 'none' }
  }

  /** 트리 클러스터 primary(latin-caribbean 등)는 Country 마스터 FK가 아니므로 foundKeys 포함 여부를 완화 */
  const primaryIsTreeClusterOnly =
    primaryMasterCountryKey === 'latin-caribbean' ||
    primaryMasterCountryKey === 'india-nepal-sri-bhutan' ||
    primaryMasterCountryKey === 'sea-multi'

  if (
    !primaryMasterCountryKey ||
    (!foundKeys.includes(primaryMasterCountryKey) && !primaryIsTreeClusterOnly)
  ) {
    return { kind: 'multi', confidence: 'low', countryKeys: foundKeys, declaredN: declaredN }
  }

  if (primaryIsTreeClusterOnly && foundKeys.length >= 2) {
    if (nDeclared && foundKeys.length === nDeclared) {
      return { kind: 'multi', confidence: 'high', countryKeys: foundKeys, declaredN: nDeclared }
    }
    return {
      kind: 'multi',
      confidence: 'medium',
      countryKeys: foundKeys,
      declaredN: nDeclared ?? foundKeys.length,
    }
  }

  if (nDeclared && foundKeys.length === nDeclared) {
    return { kind: 'multi', confidence: 'high', countryKeys: foundKeys, declaredN: nDeclared }
  }

  if (foundKeys.length >= 2) {
    return {
      kind: 'multi',
      confidence: 'medium',
      countryKeys: foundKeys,
      declaredN: nDeclared ?? foundKeys.length,
    }
  }

  return { kind: 'multi', confidence: 'low', countryKeys: foundKeys, declaredN: declaredN }
}

/** low만 운영자 검수(pending). medium은 태그 생성·등록 가능(마스터 bar 통과 시). */
export function multiCountryNeedsOperatorReview(plan: MultiCountryAutoPlan): boolean {
  return plan.kind === 'multi' && plan.confidence === 'low'
}

/**
 * @deprecated `syncProductCountryTags` 사용. 하위 호환 re-export.
 */
export async function syncAutoMultiCountryTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts: { title: string; primaryDestination: string | null; destinationRaw: string | null },
): Promise<void> {
  const { syncProductGeoTags } = await import('@/lib/sync-product-geo-tags')
  await syncProductGeoTags(db, productId, geo, opts)
}

/**
 * I-7: 트리가 국가를 특정했는데 마스터 continent/단일 도시 cityKey를 채우지 못하면 등록 승인 불가(pending).
 */
export function masterGeoMeetsRegistrationBar(
  tree: ProductLocationKeyPrismaFields,
  enriched: ProductLocationKeyPrismaFields,
): boolean {
  if (!tree.countryKey?.trim()) return true
  if (!enriched.continentKey?.trim()) return false
  if (!enriched.countryKey?.trim()) return false

  const mapped = mapTreeKeysToMasterKeys({
    groupKey: tree.groupKey,
    countryKey: tree.countryKey,
    nodeKey: tree.nodeKey,
  })
  if (mapped.cityKey?.trim() && !isMultiCityClusterNode(mapped.cityKey)) {
    if (!enriched.cityKey?.trim()) return false
  }
  return true
}
