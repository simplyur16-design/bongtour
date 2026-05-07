/**
 * I-2-PATCH: MegaMenuGroupCard ↔ Country/City 커버리지 검증 (+ 선택적 마이그레이션 SQL 생성)
 *
 *   npx tsx scripts/verify-megamenu-master-coverage.ts
 *   npx tsx scripts/verify-megamenu-master-coverage.ts --emit-sql
 *   npx tsx scripts/verify-megamenu-master-coverage.ts --emit-sql --no-db
 *
 * --emit-sql: prisma/migrations + supabase/migrations 에 동일 SQL 기록 (트리 SSOT 기반 페이로드)
 * --no-db: DB orphan 검사 생략 (SQL 파일만 갱신)
 */
import './load-env-for-scripts'

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { prisma } from '@/lib/prisma'

import { buildMegaMenuRegionCardPayload } from './seed-master-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

/** 해외 트리 SSOT 밖에서만 시드되는 국가 (메가메뉴 권역 카드에 필수 매핑 아님) */
const COUNTRY_KEYS_EXEMPT_FROM_CARD: ReadonlySet<string> = new Set(['korea'])

function sqlQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function buildMegamenuPatchSql(): string {
  const p = buildMegaMenuRegionCardPayload()
  const lines: string[] = []

  lines.push(`-- I-2-PATCH: 메가메뉴 권역 카드(트리 G 노드 6개) + Country/City 매핑`)
  lines.push(`-- 생성: scripts/verify-megamenu-master-coverage.ts --emit-sql`)
  lines.push(`-- 근거: buildMegaMenuRegionCardPayload() → SSOT lib/overseas-location-tree.data.ts`)
  lines.push('')

  for (const c of p.cards) {
    lines.push(
      `INSERT INTO "MegaMenuGroupCard" ("cardKey", "koreanLabel", "continentKey", "displayMode", "sortOrder", "isActive") VALUES (${sqlQuote(c.cardKey)}, ${sqlQuote(c.koreanLabel)}, ${sqlQuote(c.continentKey)}, ${sqlQuote(c.displayMode)}, ${c.sortOrder}, true) ON CONFLICT ("cardKey") DO NOTHING;`,
    )
  }

  lines.push('')

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  const countryRows = p.cardCountryPairs.map(
    (r) => `(${sqlQuote(r.cardKey)}, ${sqlQuote(r.countryKey)}, ${r.sortOrder})`,
  )
  for (const part of chunk(countryRows, 40)) {
    lines.push(
      `INSERT INTO "MegaMenuGroupCardCountry" ("id", "cardKey", "countryKey", "sortOrder") SELECT gen_random_uuid()::text, v."cardKey", v."countryKey", v."sortOrder" FROM (VALUES ${part.join(', ')}) AS v("cardKey", "countryKey", "sortOrder") ON CONFLICT ("cardKey", "countryKey") DO NOTHING;`,
    )
  }

  lines.push('')

  const cityRows = p.cardCityPairs.map(
    (r) => `(${sqlQuote(r.cardKey)}, ${sqlQuote(r.cityKey)}, ${r.sortOrder})`,
  )
  for (const part of chunk(cityRows, 40)) {
    lines.push(
      `INSERT INTO "MegaMenuGroupCardCity" ("id", "cardKey", "cityKey", "sortOrder") SELECT gen_random_uuid()::text, v."cardKey", v."cityKey", v."sortOrder" FROM (VALUES ${part.join(', ')}) AS v("cardKey", "cityKey", "sortOrder") ON CONFLICT ("cardKey", "cityKey") DO NOTHING;`,
    )
  }

  lines.push('')
  return lines.join('\n')
}

async function main(): Promise<void> {
  const emit = process.argv.includes('--emit-sql')
  const noDb = process.argv.includes('--no-db')

  const payload = buildMegaMenuRegionCardPayload()
  console.log(
    JSON.stringify(
      {
        treeGroups: payload.stats.groupCount,
        newRegionCards: payload.stats.cardCount,
        insertCountryLinks: payload.stats.countryLinkCount,
        insertCityLinks: payload.stats.cityLinkCount,
        countriesPerCard: payload.stats.countriesPerCard,
        citiesPerCard: payload.stats.citiesPerCard,
      },
      null,
      2,
    ),
  )

  if (emit) {
    const sql = buildMegamenuPatchSql()
    const dirPrisma = join(REPO_ROOT, 'prisma', 'migrations', '20260510120000_megamenu_card_seed_patch')
    mkdirSync(dirPrisma, { recursive: true })
    const pathPrisma = join(dirPrisma, 'migration.sql')
    writeFileSync(pathPrisma, sql, 'utf8')
    const pathSupa = join(REPO_ROOT, 'supabase', 'migrations', '20260510120000_megamenu_card_seed_patch.sql')
    mkdirSync(dirname(pathSupa), { recursive: true })
    writeFileSync(pathSupa, sql, 'utf8')
    console.log('[emit-sql] wrote', pathPrisma)
    console.log('[emit-sql] wrote', pathSupa)
  }

  if (noDb) {
    console.log('[verify-megamenu] --no-db: Prisma orphan 검사 생략')
    return
  }

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    select: { countryKey: true, koreanLabel: true },
  })
  const countryLinks = await prisma.megaMenuGroupCardCountry.findMany({
    select: { countryKey: true },
  })
  const countryLinked = new Set(countryLinks.map((r) => r.countryKey))

  const orphanCountries = countries.filter(
    (c) => !countryLinked.has(c.countryKey) && !COUNTRY_KEYS_EXEMPT_FROM_CARD.has(c.countryKey),
  )

  const cities = await prisma.city.findMany({
    where: { isActive: true },
    select: { cityKey: true, countryKey: true, koreanLabel: true },
  })
  const cityLinks = await prisma.megaMenuGroupCardCity.findMany({ select: { cityKey: true } })
  const cityLinked = new Set(cityLinks.map((r) => r.cityKey))

  const orphanCities = cities.filter((c) => {
    if (COUNTRY_KEYS_EXEMPT_FROM_CARD.has(c.countryKey)) return false
    return !cityLinked.has(c.cityKey)
  })

  const exemptCountries = countries.filter((c) => COUNTRY_KEYS_EXEMPT_FROM_CARD.has(c.countryKey))
  const exemptCountryOrphans = exemptCountries.filter((c) => !countryLinked.has(c.countryKey))

  console.log(
    JSON.stringify(
      {
        dbActiveCountries: countries.length,
        dbActiveCities: cities.length,
        orphanCountryCount: orphanCountries.length,
        orphanCityCount: orphanCities.length,
        orphanCountrySample: orphanCountries.slice(0, 25).map((c) => c.countryKey),
        orphanCitySample: orphanCities.slice(0, 25).map((c) => c.cityKey),
        exemptCountryWithoutCard: exemptCountryOrphans.map((c) => c.countryKey),
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()

  if (orphanCountries.length > 0 || orphanCities.length > 0) {
    console.warn(
      '[verify-megamenu] 마이그레이션 미적용이거나, DB에만 있는 도시가 트리 커버리지 밖일 수 있습니다.',
    )
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
