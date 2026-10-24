/**
 * READ ONLY: mega-menu leaf ↔ DB tag counts + heal-candidate counts.
 * Does NOT call heal/update. Writes docs/audit/2026-10-24/mega-menu-db-matrix.json
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { databaseHostOnly, withReadOnlyPrisma } from './read-only-prisma'

type Leaf = {
  tabId: string
  leafLabel: string
  kind: string
  citySlug: string | null
  browseCountryLabel: string
  href: string
}

async function main() {
  const host = databaseHostOnly()
  console.log(`[audit] DB host=${host.host} (credentials omitted)`)

  const leavesPath = join(process.cwd(), 'docs/audit/2026-10-24/mega-menu-leaves.json')
  if (!existsSync(leavesPath)) {
    console.error('Run export-mega-menu-leaves.ts first')
    process.exit(1)
  }
  const leavesDoc = JSON.parse(readFileSync(leavesPath, 'utf8')) as { leaves: Leaf[] }
  const cityLeaves = leavesDoc.leaves.filter((l) => l.kind === 'city' && l.citySlug)

  const out = await withReadOnlyPrisma(async (tx) => {
    const cardCities = await tx.megaMenuGroupCardCity.findMany({
      select: {
        cityKey: true,
        cardKey: true,
        city: { select: { koreanLabel: true, countryKey: true } },
      },
      take: 5000,
    })
    const cardCityKeys = new Set(cardCities.map((c) => c.cityKey))

    const registeredWithCity = await tx.product.count({
      where: {
        registrationStatus: 'registered',
        cityKey: { not: null },
      },
    })
    const registeredMissingCityTag = await tx.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*)::bigint AS cnt
       FROM "Product" p
       WHERE p."registrationStatus" = 'registered'
         AND p."cityKey" IS NOT NULL
         AND p."cityKey" <> ''
         AND NOT EXISTS (
           SELECT 1 FROM "ProductCityTag" t WHERE t."productId" = p.id
         )`,
    )

    const orphanCityTags = await tx.$queryRawUnsafe<Array<{ cityKey: string; cnt: bigint }>>(
      `SELECT t."cityKey", COUNT(*)::bigint AS cnt
       FROM "ProductCityTag" t
       INNER JOIN "Product" p ON p.id = t."productId"
       WHERE p."registrationStatus" = 'registered'
       GROUP BY t."cityKey"
       ORDER BY cnt DESC
       LIMIT 80`,
    )

    const cityTagAgg = await tx.$queryRawUnsafe<Array<{ cityKey: string; cnt: bigint }>>(
      `SELECT t."cityKey", COUNT(*)::bigint AS cnt
       FROM "ProductCityTag" t
       INNER JOIN "Product" p ON p.id = t."productId"
       WHERE p."registrationStatus" = 'registered'
       GROUP BY t."cityKey"`,
    )
    const cityTagMap = new Map(cityTagAgg.map((r) => [r.cityKey, Number(r.cnt)]))

    const matrix = cityLeaves.map((leaf) => {
      const ck = leaf.citySlug!
      return {
        leafLabel: leaf.leafLabel,
        tabId: leaf.tabId,
        href: leaf.href,
        cityKey: ck,
        cardCityExists: cardCityKeys.has(ck),
        registeredCityTagCount: cityTagMap.get(ck) ?? 0,
      }
    })
    const zeroCityTagLeaves = matrix.filter((m) => m.registeredCityTagCount === 0)
    const missingCardCity = matrix.filter((m) => !m.cardCityExists)

    return {
      host: host.host,
      registeredWithCityKey: registeredWithCity,
      registeredMissingCityTag: Number(registeredMissingCityTag[0]?.cnt ?? 0),
      cardCityCount: cardCities.length,
      zeroCityTagLeafCount: zeroCityTagLeaves.length,
      missingCardCityCount: missingCardCity.length,
      zeroCityTagLeaves: zeroCityTagLeaves.slice(0, 80),
      missingCardCityLeaves: missingCardCity.slice(0, 80),
      orphanCityTagTop: orphanCityTags.map((r) => ({
        cityKey: r.cityKey,
        count: Number(r.cnt),
      })),
      matrixSampleSize: matrix.length,
      matrix,
    }
  })

  const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, 'mega-menu-db-matrix.json')
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), ...out }, null, 2), 'utf8')
  console.log(`[audit] wrote ${path}`)
  console.log(
    `[audit] missingCityTag=${out.registeredMissingCityTag} cardCities=${out.cardCityCount} matrixRows=${out.matrixSampleSize}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
