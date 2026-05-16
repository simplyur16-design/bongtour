/**
 * Product.cityKey 가 국가·권역 슬러그(it, es, fr …)인 경우 제목에서 더 구체적 City로 보정.
 * SQL/스크립트·운영 점검 공통.
 */
import type { PrismaClient } from '@prisma/client'
import { deriveTreeGeoFromMasterPrimary } from '@/lib/geo-audit-tree-from-master'
import { prisma } from '@/lib/prisma'

/** browse 트리 국가·권역 단위 nodeKey — 도시 세분화 가능한 후보만 대상 */
export const COUNTRY_LEVEL_CITY_KEYS = [
  'it',
  'es',
  'fr',
  'de',
  'at',
  'pt',
  'hu',
  'ch',
  'cz',
  'nl',
  'be',
  'uk',
  'ie',
  'ma',
  'sicily',
] as const

export type ProductCityKeyFixRow = {
  id: string
  title: string
  countryKey: string | null
  cityKey: string
  nextCityKey: string
  nextCityLabel: string
}

/**
 * 제목 기반 세분 cityKey 추론. City 마스터에 존재·국가 일치하는 경우만 반환.
 */
export function inferSpecificCityKeyFromTitle(
  countryKey: string,
  currentCityKey: string,
  title: string,
  cityByKey: Map<string, { cityKey: string; countryKey: string; koreanLabel: string }>,
): { cityKey: string; koreanLabel: string } | null {
  const t = title.trim()
  let candidate: string | null = null

  if (countryKey === 'italy' && currentCityKey === 'it') {
    if (/시칠리|sicil|palermo|팔레르모/i.test(t)) candidate = 'sicily'
  } else if (countryKey === 'france' && currentCityKey === 'fr') {
    if (/니스|nice|cannes|칸|코트다|cote\s*d|south\s*france|남프랑스/i.test(t)) candidate = 'cotedazur'
  } else if (countryKey === 'united-kingdom' && currentCityKey === 'uk') {
    if (/아일랜드|ireland|더블린|dublin/i.test(t)) candidate = 'ie'
  } else if (countryKey === 'ireland' && currentCityKey === 'ie') {
    return null
  } else if (countryKey === 'spain' && currentCityKey === 'es') {
    return null
  }

  if (!candidate || candidate === currentCityKey) return null
  const city = cityByKey.get(candidate)
  if (!city?.koreanLabel || city.countryKey !== countryKey) return null
  return { cityKey: candidate, koreanLabel: city.koreanLabel }
}

export async function listProductCityKeyCountrySlugFixCandidates(
  db: PrismaClient = prisma,
): Promise<ProductCityKeyFixRow[]> {
  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { cityKey: true, countryKey: true, koreanLabel: true },
  })
  const cityByKey = new Map(cities.map((c) => [c.cityKey, c]))

  const products = await db.product.findMany({
    where: {
      registrationStatus: 'registered',
      NOT: { travelScope: 'domestic' },
      cityKey: { in: [...COUNTRY_LEVEL_CITY_KEYS] },
    },
    select: {
      id: true,
      title: true,
      countryKey: true,
      cityKey: true,
    },
  })

  const out: ProductCityKeyFixRow[] = []
  for (const p of products) {
    const cityKey = p.cityKey?.trim()
    const countryKey = p.countryKey?.trim()
    if (!cityKey || !countryKey) continue
    const inferred = inferSpecificCityKeyFromTitle(countryKey, cityKey, p.title ?? '', cityByKey)
    if (!inferred) continue
    out.push({
      id: p.id,
      title: p.title,
      countryKey,
      cityKey,
      nextCityKey: inferred.cityKey,
      nextCityLabel: inferred.koreanLabel,
    })
  }
  return out
}

export type ApplyProductCityKeyFixResult = {
  id: string
  cityKey: string
  nextCityKey: string
  applied: boolean
  reason?: string
}

export async function applyProductCityKeyCountrySlugFixes(
  rows: ProductCityKeyFixRow[],
  db: PrismaClient = prisma,
): Promise<ApplyProductCityKeyFixResult[]> {
  const results: ApplyProductCityKeyFixResult[] = []

  for (const row of rows) {
    const city = await db.city.findUnique({
      where: { cityKey: row.nextCityKey },
      select: { cityKey: true, countryKey: true, koreanLabel: true, isActive: true },
    })
    if (!city?.isActive || city.countryKey !== row.countryKey) {
      results.push({
        id: row.id,
        cityKey: row.cityKey,
        nextCityKey: row.nextCityKey,
        applied: false,
        reason: 'city_not_in_master',
      })
      continue
    }

    const tree = deriveTreeGeoFromMasterPrimary(row.countryKey, row.nextCityKey)
    const now = new Date()

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: row.id },
        data: {
          cityKey: row.nextCityKey,
          city: city.koreanLabel,
          nodeKey: tree.nodeKey,
          groupKey: tree.groupKey ?? undefined,
          continent: tree.continent ?? undefined,
          locationMatchConfidence: 'high',
          locationMatchSource: 'geo-audit:citykey-country-slug-fix',
          lastGeoAuditAt: now,
          geoAuditSkippedAt: null,
          geoAuditLastPatchJson: JSON.stringify({
            action: 'citykey_country_slug_fix',
            at: now.toISOString(),
            fromCityKey: row.cityKey,
            toCityKey: row.nextCityKey,
            title: row.title,
          }),
        },
      })
      await tx.productCityTag.updateMany({
        where: { productId: row.id, cityKey: row.cityKey, isPrimary: true },
        data: { cityKey: row.nextCityKey },
      })
    })

    results.push({
      id: row.id,
      cityKey: row.cityKey,
      nextCityKey: row.nextCityKey,
      applied: true,
    })
  }

  return results
}
