/**
 * ProductCountryTag SSOT — 등록·백필 공통.
 * 다국가 high confidence → 다건 태그. 그 외 countryKey 있으면 primary 1행 강제.
 */
import type { Prisma } from '@prisma/client'
import { findGroupKeyForCountryKey } from '@/lib/overseas-location-tree'
import {
  detectMultiCountryAutoPlan,
  type MultiCountryAutoPlan,
} from '@/lib/normalize-product-geo-master'
import { defaultNodeKeyForMasterCountryTag } from '@/lib/default-node-key-for-country-tag'
import { isMultiCityClusterNode } from '@/lib/product-master-mapping'
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'

export type SyncProductCountryTagsOpts = {
  title: string
  primaryDestination: string | null
  destinationRaw: string | null
  scheduleHaystack?: string | null
}

/** 마스터 countryKey → 트리 groupKey (중남미는 트리 countryKey가 latin-caribbean 클러스터) */
function groupKeyForMasterCountryTag(countryKey: string): string | null {
  const fromTree = findGroupKeyForCountryKey(countryKey)
  if (fromTree) return fromTree
  // REGRESSION-FREEZE[mega-menu-product-alignment]: SA master countries → americas group — manifest
  if (
    countryKey === 'peru' ||
    countryKey === 'bolivia' ||
    countryKey === 'brazil' ||
    countryKey === 'argentina' ||
    countryKey === 'chile' ||
    countryKey === 'mexico' ||
    countryKey === 'cuba' ||
    countryKey === 'dominican-republic'
  ) {
    return 'americas'
  }
  return null
}

function buildMultiCountryTagRows(
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  countryKeys: string[],
): Array<{
  productId: string
  countryKey: string
  nodeKey: string | null
  groupKey: string
  isPrimary: boolean
  sortOrder: number
}> | null {
  const primary = geo.countryKey?.trim()
  const keys = [...new Set(countryKeys.map((k) => k.trim()).filter(Boolean))]
  if (keys.length < 2) return null

  /** 트리 클러스터(latin-caribbean)는 Country FK가 아니므로 found master keys만 태그 */
  const ordered =
    primary && keys.includes(primary)
      ? [primary, ...keys.filter((k) => k !== primary)]
      : keys

  const rows = ordered.map((countryKey, i) => {
    const groupKey = groupKeyForMasterCountryTag(countryKey)
    if (!groupKey) return null
    const defaultNk = defaultNodeKeyForMasterCountryTag(countryKey)
    const nodeKey =
      defaultNk ??
      (i === 0 && geo.countryKey?.trim() === countryKey ? geo.nodeKey?.trim() || null : null)
    return {
      productId,
      countryKey,
      nodeKey: nodeKey ?? null,
      groupKey,
      isPrimary: i === 0,
      sortOrder: i,
    }
  })

  if (rows.some((r) => r == null)) return null
  return rows as NonNullable<(typeof rows)[number]>[]
}

type ProductCountryTagInsertRow = {
  productId: string
  countryKey: string
  nodeKey: string | null
  groupKey: string
  isPrimary: boolean
  sortOrder: number
}

/** Country 마스터에 없는 countryKey는 ProductCountryTag FK 위반 — createMany 전 1회 조회로 필터 */
async function filterRowsToExistingMasterCountries(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  rows: ProductCountryTagInsertRow[],
): Promise<ProductCountryTagInsertRow[]> {
  if (rows.length === 0) return rows
  const keys = [...new Set(rows.map((r) => r.countryKey))]
  const existing = await db.country.findMany({
    where: { countryKey: { in: keys }, isActive: true },
    select: { countryKey: true },
  })
  const allowed = new Set(existing.map((c) => c.countryKey))
  return rows.filter((r) => allowed.has(r.countryKey))
}

function buildSinglePrimaryTagRow(
  productId: string,
  geo: ProductLocationKeyPrismaFields,
): Array<{
  productId: string
  countryKey: string
  nodeKey: string | null
  groupKey: string
  isPrimary: boolean
  sortOrder: number
}> | null {
  const countryKey = geo.countryKey?.trim()
  if (!countryKey) return null

  const groupKey = (geo.groupKey ?? groupKeyForMasterCountryTag(countryKey))?.trim()
  if (!groupKey) return null

  const nodeKey =
    geo.nodeKey?.trim() ||
    (geo.cityKey?.trim() && !isMultiCityClusterNode(geo.cityKey) ? geo.cityKey.trim() : null) ||
    null

  return [
    {
      productId,
      countryKey,
      nodeKey,
      groupKey,
      isPrimary: true,
      sortOrder: 0,
    },
  ]
}

/**
 * 상품 1건 ProductCountryTag 동기화 — 기존 태그 전부 교체.
 */
export async function syncProductCountryTags(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  geo: ProductLocationKeyPrismaFields,
  opts: SyncProductCountryTagsOpts,
): Promise<{ plan: MultiCountryAutoPlan; tagCount: number }> {
  await db.productCountryTag.deleteMany({ where: { productId } })

  const countryKey = geo.countryKey?.trim()
  if (!countryKey) {
    return { plan: { kind: 'none' }, tagCount: 0 }
  }

  const plan = await detectMultiCountryAutoPlan(db, opts, countryKey)

  let rows: ReturnType<typeof buildSinglePrimaryTagRow> = null
  if (
    plan.kind === 'multi' &&
    plan.countryKeys.length >= 2 &&
    (plan.confidence === 'high' || plan.confidence === 'medium')
  ) {
    rows = buildMultiCountryTagRows(productId, geo, plan.countryKeys)
  }
  if (!rows?.length) {
    rows = buildSinglePrimaryTagRow(productId, geo)
  }

  const safeRows = rows?.length ? await filterRowsToExistingMasterCountries(db, rows) : []
  if (safeRows.length > 0) {
    await db.productCountryTag.createMany({ data: safeRows })
  }

  return { plan, tagCount: safeRows.length }
}

/**
 * 도시 태그에 묶인 국가를 ProductCountryTag에 보조 연결 (다국가 클러스터·메가메뉴 다도시).
 * 기존 primary/다국 태그는 유지하고, 아직 없는 countryKey만 추가한다.
 */
export async function syncSupplementalCountryTagsFromCityKeys(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  productId: string,
  cityKeys: readonly string[],
): Promise<number> {
  const keys = [...new Set(cityKeys.map((k) => k.trim()).filter(Boolean))]
  if (keys.length === 0) return 0

  const existing = await db.productCountryTag.findMany({
    where: { productId },
    select: { countryKey: true, sortOrder: true },
  })
  const haveCountry = new Set(existing.map((t) => t.countryKey))
  let nextSort =
    existing.length > 0 ? Math.max(...existing.map((t) => t.sortOrder)) + 1 : 1

  const cities = await db.city.findMany({
    where: { cityKey: { in: keys } },
    select: { cityKey: true, countryKey: true },
  })

  const rows: Array<{
    productId: string
    countryKey: string
    nodeKey: string | null
    groupKey: string
    isPrimary: boolean
    sortOrder: number
  }> = []

  for (const c of cities) {
    if (haveCountry.has(c.countryKey)) continue
    const groupKey = findGroupKeyForCountryKey(c.countryKey)?.trim()
    if (!groupKey) continue
    rows.push({
      productId,
      countryKey: c.countryKey,
      nodeKey: c.cityKey,
      groupKey,
      isPrimary: false,
      sortOrder: nextSort++,
    })
    haveCountry.add(c.countryKey)
  }

  const safeRows = await filterRowsToExistingMasterCountries(db, rows)
  if (safeRows.length > 0) {
    await db.productCountryTag.createMany({ data: safeRows })
  }
  return safeRows.length
}
