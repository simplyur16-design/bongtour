/**
 * I-7: 마스터·메가메뉴 카드 정합 검증 (cron·어드민·수동 실행 공통).
 */
import { Prisma, type PrismaClient } from '@prisma/client'

export type MasterIntegrityCounts = {
  registeredOverseas: number
  pendingOverseas: number
  /** Product.countryKey 가 Country에 없거나 비활성 */
  invalidCountryKeyRefs: number
  /** Product.continentKey 가 Continent에 없음 */
  invalidContinentKeyRefs: number
  /** Product.cityKey 가 City에 없거나 비활성·국가 불일치 */
  invalidCityKeyRefs: number
  /** continentKey·countryKey 있으나 country 한글 ≠ Country.koreanLabel */
  labelCountryMismatch: number
  /** cityKey 있으나 city 한글 ≠ City.koreanLabel */
  labelCityMismatch: number
  /** 등록 완료 해외인데 continentKey NULL */
  nullContinentRegisteredOverseas: number
  /** 대표 국가 태그가 Product.countryKey 와 다름 */
  primaryCountryTagMismatch: number
  /** 대표 도시 태그가 Product.cityKey 와 다름 (또는 Product에 cityKey 있는데 태그 불일치) */
  primaryCityTagMismatch: number
  brokenTotal: number
}

export type MasterIntegrityReport = {
  at: string
  counts: MasterIntegrityCounts
  sampleIds: Record<string, string[]>
  /** 활성 메가메뉴 카드별 노출 후보 상품 수(대표 국가 또는 국가 태그가 카드 국가에 속하는 등록 완료 해외 상품) */
  cardProductCounts: Array<{ cardKey: string; koreanLabel: string; productCount: number }>
}

const SAMPLE_CAP = 12

async function distinctIds(db: Prisma.TransactionClient | PrismaClient, query: Prisma.Sql): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>(query)
  return rows.map((r) => r.id).filter(Boolean)
}

export async function runMasterIntegrityCheck(
  db: Prisma.TransactionClient | PrismaClient,
): Promise<MasterIntegrityReport> {
  const at = new Date().toISOString()

  const [registeredOverseas, pendingOverseas] = await Promise.all([
    db.product.count({
      where: { registrationStatus: 'registered', NOT: { travelScope: 'domestic' } },
    }),
    db.product.count({
      where: { registrationStatus: 'pending', NOT: { travelScope: 'domestic' } },
    }),
  ])

  const [
    invalidCountryKeyRefs,
    invalidContinentKeyRefs,
    invalidCityKeyRefs,
    labelCountryMismatch,
    labelCityMismatch,
    nullContinentRegisteredOverseas,
    primaryCountryTagMismatch,
    primaryCityTagMismatch,
  ] = await Promise.all([
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        LEFT JOIN "Country" c ON c."countryKey" = p."countryKey" AND c."isActive" = true
        WHERE p."countryKey" IS NOT NULL AND TRIM(p."countryKey") != ''
          AND c."countryKey" IS NULL
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        LEFT JOIN "Continent" x ON x."continentKey" = p."continentKey"
        WHERE p."continentKey" IS NOT NULL AND TRIM(p."continentKey") != ''
          AND x."continentKey" IS NULL
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        LEFT JOIN "City" ci ON ci."cityKey" = p."cityKey" AND ci."isActive" = true
        WHERE p."cityKey" IS NOT NULL AND TRIM(p."cityKey") != ''
          AND (
            ci."cityKey" IS NULL
            OR (p."countryKey" IS NOT NULL AND ci."countryKey" IS DISTINCT FROM p."countryKey")
          )
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        INNER JOIN "Country" c ON c."countryKey" = p."countryKey" AND c."isActive" = true
        WHERE p."continentKey" IS NOT NULL
          AND p."country" IS NOT NULL AND TRIM(p."country") != ''
          AND TRIM(p."country") IS DISTINCT FROM TRIM(c."koreanLabel")
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        INNER JOIN "City" ci ON ci."cityKey" = p."cityKey" AND ci."isActive" = true
        WHERE p."cityKey" IS NOT NULL
          AND p."city" IS NOT NULL AND TRIM(p."city") != ''
          AND TRIM(p."city") IS DISTINCT FROM TRIM(ci."koreanLabel")
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        WHERE p."registrationStatus" = 'registered'
          AND (p."travelScope" IS NULL OR p."travelScope" != 'domestic')
          AND p."continentKey" IS NULL
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        INNER JOIN "ProductCountryTag" t ON t."productId" = p.id AND t."isPrimary" = true
        WHERE t."countryKey" IS DISTINCT FROM p."countryKey"
      `,
    ),
    distinctIds(
      db,
      Prisma.sql`
        SELECT DISTINCT p.id::text AS id FROM "Product" p
        INNER JOIN "ProductCityTag" t ON t."productId" = p.id AND t."isPrimary" = true
        WHERE (p."cityKey" IS NOT NULL AND t."cityKey" IS DISTINCT FROM p."cityKey")
           OR (p."cityKey" IS NULL AND t."isPrimary" = true)
      `,
    ),
  ])

  const mergeUnique = (ids: string[]) => Array.from(new Set(ids))

  const sampleIds: Record<string, string[]> = {
    invalidCountryKeyRefs: mergeUnique(invalidCountryKeyRefs).slice(0, SAMPLE_CAP),
    invalidContinentKeyRefs: mergeUnique(invalidContinentKeyRefs).slice(0, SAMPLE_CAP),
    invalidCityKeyRefs: mergeUnique(invalidCityKeyRefs).slice(0, SAMPLE_CAP),
    labelCountryMismatch: mergeUnique(labelCountryMismatch).slice(0, SAMPLE_CAP),
    labelCityMismatch: mergeUnique(labelCityMismatch).slice(0, SAMPLE_CAP),
    nullContinentRegisteredOverseas: mergeUnique(nullContinentRegisteredOverseas).slice(0, SAMPLE_CAP),
    primaryCountryTagMismatch: mergeUnique(primaryCountryTagMismatch).slice(0, SAMPLE_CAP),
    primaryCityTagMismatch: mergeUnique(primaryCityTagMismatch).slice(0, SAMPLE_CAP),
  }

  const brokenSet = new Set<string>()
  for (const arr of [
    invalidCountryKeyRefs,
    invalidContinentKeyRefs,
    invalidCityKeyRefs,
    labelCountryMismatch,
    labelCityMismatch,
    nullContinentRegisteredOverseas,
    primaryCountryTagMismatch,
    primaryCityTagMismatch,
  ]) {
    for (const id of arr) brokenSet.add(id)
  }

  const cards = await db.megaMenuGroupCard.findMany({
    where: { isActive: true },
    select: {
      cardKey: true,
      koreanLabel: true,
      countries: { select: { countryKey: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  const cardProductCounts: MasterIntegrityReport['cardProductCounts'] = []
  for (const card of cards) {
    const countryKeys = card.countries.map((c) => c.countryKey).filter(Boolean)
    if (countryKeys.length === 0) {
      cardProductCounts.push({ cardKey: card.cardKey, koreanLabel: card.koreanLabel, productCount: 0 })
      continue
    }
    const n = await db.product.count({
      where: {
        registrationStatus: 'registered',
        NOT: { travelScope: 'domestic' },
        OR: [
          { countryKey: { in: countryKeys } },
          { countryTags: { some: { countryKey: { in: countryKeys } } } },
        ],
      },
    })
    cardProductCounts.push({ cardKey: card.cardKey, koreanLabel: card.koreanLabel, productCount: n })
  }

  const counts: MasterIntegrityCounts = {
    registeredOverseas,
    pendingOverseas,
    invalidCountryKeyRefs: invalidCountryKeyRefs.length,
    invalidContinentKeyRefs: invalidContinentKeyRefs.length,
    invalidCityKeyRefs: invalidCityKeyRefs.length,
    labelCountryMismatch: labelCountryMismatch.length,
    labelCityMismatch: labelCityMismatch.length,
    nullContinentRegisteredOverseas: nullContinentRegisteredOverseas.length,
    primaryCountryTagMismatch: primaryCountryTagMismatch.length,
    primaryCityTagMismatch: primaryCityTagMismatch.length,
    brokenTotal: brokenSet.size,
  }

  return { at, counts, sampleIds, cardProductCounts }
}

export function formatMasterIntegritySms(report: MasterIntegrityReport): string {
  const c = report.counts
  const lines = [
    '[봉투어] 마스터 정합 일일 점검',
    `시각: ${report.at}`,
    `등록해외 ${c.registeredOverseas} · 등록대기해외 ${c.pendingOverseas}`,
    `정규화 이상(고유상품수) ${c.brokenTotal}`,
    `무효countryKey ${c.invalidCountryKeyRefs} · 무효continentKey ${c.invalidContinentKeyRefs} · 무효cityKey ${c.invalidCityKeyRefs}`,
    `라벨불일치 country ${c.labelCountryMismatch} · city ${c.labelCityMismatch}`,
    `continentKey누락(등록해외) ${c.nullContinentRegisteredOverseas}`,
    `태그불일치 country ${c.primaryCountryTagMismatch} · city ${c.primaryCityTagMismatch}`,
    '상세: /admin/products/master-integrity',
  ]
  return lines.join('\n').slice(0, 2000)
}
