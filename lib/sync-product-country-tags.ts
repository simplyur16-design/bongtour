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
import type { ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'

export type SyncProductCountryTagsOpts = {
  title: string
  primaryDestination: string | null
  destinationRaw: string | null
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
  if (!primary || !countryKeys.includes(primary)) return null

  const ordered = [primary, ...countryKeys.filter((k) => k !== primary)]
  if (ordered.length !== countryKeys.length) return null

  const rows = ordered.map((countryKey, i) => {
    const groupKey = findGroupKeyForCountryKey(countryKey)
    if (!groupKey) return null
    return {
      productId,
      countryKey,
      nodeKey: i === 0 ? geo.nodeKey?.trim() || null : null,
      groupKey,
      isPrimary: i === 0,
      sortOrder: i,
    }
  })

  if (rows.some((r) => r == null)) return null
  return rows as NonNullable<(typeof rows)[number]>[]
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

  const groupKey = (geo.groupKey ?? findGroupKeyForCountryKey(countryKey))?.trim()
  if (!groupKey) return null

  return [
    {
      productId,
      countryKey,
      nodeKey: geo.nodeKey?.trim() || null,
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
  if (plan.kind === 'multi' && plan.confidence === 'high' && plan.countryKeys.length >= 2) {
    rows = buildMultiCountryTagRows(productId, geo, plan.countryKeys)
  }
  if (!rows?.length) {
    rows = buildSinglePrimaryTagRow(productId, geo)
  }

  if (rows?.length) {
    await db.productCountryTag.createMany({ data: rows })
  }

  return { plan, tagCount: rows?.length ?? 0 }
}
