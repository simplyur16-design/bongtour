/**
 * I-6: 트리 키 → 마스터 Continent/Country/City 정합 + 보수적 다국가 자동 태그.
 */
import type { Prisma } from '@prisma/client'
import { resolveProductCityToKoreanDisplay, resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { findGroupKeyForCountryKey } from '@/lib/overseas-location-tree'
import {
  isMultiCityClusterNode,
  mapTreeKeysToMasterKeys,
  type MapTreeKeysInput,
  type MapTreeKeysResult,
} from '@/lib/product-master-mapping'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'
import { continentTabIdForMatch } from '@/lib/unified-location-tree'

/** `mapTreeKeysToMaster` 명세 — I-3 `mapTreeKeysToMasterKeys` 별칭 */
export function mapTreeKeysToMaster(input: MapTreeKeysInput): MapTreeKeysResult {
  return mapTreeKeysToMasterKeys(input)
}

const BROWSE_SLUG_PREFER_TREE_KR_LABEL = new Set([
  'latin-caribbean',
  'latin-america',
  'latin-mexico',
  'alaska-caribbean-cruise',
])

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

/**
 * D-3 트리 추론 결과에 마스터 라벨·FK(continentKey/cityKey)·canonical countryKey 보강.
 */
export async function enrichPrismaGeoWithMasterLabels(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  d: ProductLocationKeyPrismaFields,
): Promise<ProductLocationKeyPrismaFields> {
  const mapped = mapTreeKeysToMasterKeys({
    groupKey: d.groupKey,
    countryKey: d.countryKey,
    nodeKey: d.nodeKey,
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

function declaredCountryCountFromTitle(title: string): number | null {
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
export async function detectMultiCountryAutoPlan(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  opts: { title: string; primaryDestination: string | null; destinationRaw: string | null },
  primaryMasterCountryKey: string | null,
): Promise<MultiCountryAutoPlan> {
  const title = opts.title.trim()
  const n = declaredCountryCountFromTitle(title)
  if (!n) return { kind: 'none' }

  const hay = [title, opts.primaryDestination, opts.destinationRaw].filter(Boolean).join('\n')
  if (!hay.trim()) return { kind: 'multi', confidence: 'low', countryKeys: [], declaredN: n }

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
    if (hay.includes(label) && !used.has(c.countryKey)) {
      foundKeys.push(c.countryKey)
      used.add(c.countryKey)
    }
  }

  const labelIndex = (countryKey: string) => {
    const label = countries.find((x) => x.countryKey === countryKey)?.koreanLabel ?? ''
    const i = label ? hay.indexOf(label) : -1
    return i === -1 ? 99999 : i
  }
  foundKeys.sort((a, b) => labelIndex(a) - labelIndex(b))

  if (!primaryMasterCountryKey || !foundKeys.includes(primaryMasterCountryKey)) {
    return { kind: 'multi', confidence: 'low', countryKeys: foundKeys, declaredN: n }
  }
  if (foundKeys.length === n) {
    return { kind: 'multi', confidence: 'high', countryKeys: foundKeys, declaredN: n }
  }
  if (foundKeys.length >= 2) {
    return { kind: 'multi', confidence: 'medium', countryKeys: foundKeys, declaredN: n }
  }
  return { kind: 'multi', confidence: 'low', countryKeys: foundKeys, declaredN: n }
}

export function multiCountryNeedsOperatorReview(plan: MultiCountryAutoPlan): boolean {
  return plan.kind === 'multi' && plan.confidence !== 'high'
}

/**
 * high일 때만 ProductCountryTag 자동 삽입. 그 외에는 기존 자동 태그 제거(단일국가 정리).
 */
export async function syncAutoMultiCountryTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts: { title: string; primaryDestination: string | null; destinationRaw: string | null },
): Promise<void> {
  const plan = await detectMultiCountryAutoPlan(db, opts, geo.countryKey)
  await db.productCountryTag.deleteMany({ where: { productId } })
  if (plan.kind !== 'multi' || plan.confidence !== 'high' || plan.countryKeys.length < 2) return

  const primary = geo.countryKey
  if (!primary || !plan.countryKeys.includes(primary)) return

  const ordered = [primary, ...plan.countryKeys.filter((k) => k !== primary)]
  if (ordered.length !== plan.countryKeys.length) return

  const rows = ordered.map((countryKey, i) => {
    const groupKey = findGroupKeyForCountryKey(countryKey)
    return {
      productId,
      countryKey,
      nodeKey: i === 0 ? geo.nodeKey ?? null : null,
      groupKey: groupKey ?? null,
      isPrimary: i === 0,
      sortOrder: i,
    }
  })
  if (rows.some((r) => !r.groupKey)) return

  await db.productCountryTag.createMany({ data: rows })
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
