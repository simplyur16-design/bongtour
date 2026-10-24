/**
 * READ ONLY: count products that mega-menu-product-alignment heal would touch
 * (south america / central asia / caucasus-balkan style mismatches) — count only.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { databaseHostOnly, withReadOnlyPrisma } from './read-only-prisma'

async function main() {
  const host = databaseHostOnly()
  console.log(`[audit] DB host=${host.host}`)

  const out = await withReadOnlyPrisma(async (tx) => {
    const registered = await tx.product.count({ where: { registrationStatus: 'registered' } })
    const missingCityTag = await tx.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*)::bigint AS cnt FROM "Product" p
       WHERE p."registrationStatus" = 'registered'
         AND p."cityKey" IS NOT NULL AND p."cityKey" <> ''
         AND NOT EXISTS (SELECT 1 FROM "ProductCityTag" t WHERE t."productId" = p.id)`,
    )
    const missingCountryTag = await tx.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*)::bigint AS cnt FROM "Product" p
       WHERE p."registrationStatus" = 'registered'
         AND p."countryKey" IS NOT NULL AND p."countryKey" <> ''
         AND NOT EXISTS (SELECT 1 FROM "ProductCountryTag" t WHERE t."productId" = p.id)`,
    )
    // Guam + Europe clamp style: continentKey europe* but title/city suggests guam
    const guamEurope = await tx.product.count({
      where: {
        registrationStatus: 'registered',
        OR: [
          { continentKey: { contains: 'europe', mode: 'insensitive' } },
          { continent: { contains: 'europe', mode: 'insensitive' } },
        ],
        AND: [
          {
            OR: [
              { title: { contains: '괌', mode: 'insensitive' } },
              { cityKey: { contains: 'guam', mode: 'insensitive' } },
              { primaryDestination: { contains: '괌', mode: 'insensitive' } },
            ],
          },
        ],
      },
    })
    // Mongolia / Inner Mongolia confusion candidates
    const mongoliaTitleChinaKey = await tx.product.count({
      where: {
        registrationStatus: 'registered',
        countryKey: 'china',
        OR: [
          { title: { contains: '몽골', mode: 'insensitive' } },
          { title: { contains: '울란바토르', mode: 'insensitive' } },
          { title: { contains: '울란바타르', mode: 'insensitive' } },
        ],
      },
    })
    const macauHongkongSwap = await tx.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*)::bigint AS cnt FROM "Product" p
       WHERE p."registrationStatus" = 'registered'
         AND (
           (p."cityKey" ILIKE '%macau%' AND (p.title ILIKE '%홍콩%' AND p.title NOT ILIKE '%마카오%'))
           OR (p."cityKey" ILIKE '%hongkong%' AND p.title ILIKE '%마카오%' AND p.title NOT ILIKE '%홍콩%')
         )`,
    )

    return {
      registered,
      healLikeMissingCityTag: Number(missingCityTag[0]?.cnt ?? 0),
      healLikeMissingCountryTag: Number(missingCountryTag[0]?.cnt ?? 0),
      guamEuropeClampCandidates: guamEurope,
      mongoliaOnChinaKeyCandidates: mongoliaTitleChinaKey,
      macauHongkongSwapCandidates: Number(macauHongkongSwap[0]?.cnt ?? 0),
    }
  })

  const path = join(process.cwd(), 'docs/audit/2026-10-24/heal-candidate-counts.json')
  mkdirSync(join(process.cwd(), 'docs/audit/2026-10-24'), { recursive: true })
  writeFileSync(path, JSON.stringify({ generatedAt: new Date().toISOString(), host: host.host, ...out }, null, 2), 'utf8')
  console.log(JSON.stringify(out, null, 2))
  console.log(`[audit] wrote ${path}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
