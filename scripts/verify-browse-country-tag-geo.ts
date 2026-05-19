/**
 * PR2 browse — ProductCountryTag 단일 의존 검증.
 * 실행: npx tsx scripts/verify-browse-country-tag-geo.ts
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const { buildOverseasBrowseGeoResolution, resolveBrowseCardKeyToCountryKeys } = await import(
    '@/lib/browse-master-geo'
  )
  const { productMatchesBrowseUrlGeo } = await import('@/lib/match-overseas-product')
  const { publicProductWhereClause } = await import('@/lib/product-sales-policy')

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  async function countBrowseGeo(queryKey: {
    region?: string
    country?: string
    city?: string
  }): Promise<{ total: number; slugs: string[] }> {
    const geo = await buildOverseasBrowseGeoResolution({
      region: queryKey.region ?? null,
      country: queryKey.country ?? null,
      city: queryKey.city ?? null,
    })
    const rows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        AND: [...geo.whereClauses, publicProductWhereClause()],
      },
      select: { slug: true, originCode: true, countryTags: true, cityTags: true },
      orderBy: { slug: 'asc' },
    })
    const filtered = rows.filter((p) =>
      productMatchesBrowseUrlGeo(
        {
          title: '',
          originSource: '',
          countryTags: p.countryTags,
          cityTags: p.cityTags,
        },
        {
          region: queryKey.region ?? null,
          country: queryKey.country ?? null,
          city: queryKey.city ?? null,
          regionCountryKeys: geo.regionCountryKeys,
        },
      ),
    )
    const slugs = filtered.map((p) => p.slug ?? p.originCode ?? '').filter(Boolean)
    return { total: filtered.length, slugs }
  }

  try {
    const c1 = await countBrowseGeo({ region: 'nordic-baltic-cluster', country: 'denmark' })
    const want1 = ['fim-vg-0001', 'fim-vg-0002', 'pkg-hn-0006']
    for (const s of want1) {
      if (!c1.slugs.includes(s)) {
        console.error(`[FAIL] case1 missing slug ${s} (got ${c1.slugs.join(', ')})`)
        process.exit(1)
      }
    }
    console.log(`[ok] case1 nordic-baltic-cluster+denmark: ${c1.total}건 (${c1.slugs.join(', ')})`)

    const c2 = await countBrowseGeo({ region: 'japan', city: 'tokyo' })
    if (c2.total < 3) {
      console.error(`[FAIL] case2 japan+tokyo expected >=3, got ${c2.total}`)
      process.exit(1)
    }
    console.log(`[ok] case2 japan+tokyo: ${c2.total}건`)

    const c3 = await countBrowseGeo({ region: 'sea-taiwan-south-asia', country: 'vietnam' })
    if (c3.total < 12) {
      console.error(`[FAIL] case3 sea+vietnam expected >=12, got ${c3.total}`)
      process.exit(1)
    }
    console.log(`[ok] case3 sea-taiwan-south-asia+vietnam: ${c3.total}건`)

    const cardCountryRows = await prisma.megaMenuGroupCardCountry.findMany({
      where: { card: { isActive: true } },
      select: { cardKey: true, countryKey: true },
    })
    const countryToCards = new Map<string, string[]>()
    for (const row of cardCountryRows) {
      const list = countryToCards.get(row.countryKey) ?? []
      list.push(row.cardKey)
      countryToCards.set(row.countryKey, list)
    }

    const registered = await prisma.product.findMany({
      where: { registrationStatus: 'registered', AND: [publicProductWhereClause()] },
      select: {
        slug: true,
        originCode: true,
        countryTags: { select: { countryKey: true } },
      },
    })

    const orphans: string[] = []
    for (const p of registered) {
      const tagKeys = p.countryTags.map((t) => t.countryKey).filter(Boolean)
      const covered = tagKeys.some((ck) => (countryToCards.get(ck)?.length ?? 0) > 0)
      if (!covered) orphans.push(p.slug ?? p.originCode ?? '?')
    }

    if (orphans.length > 0) {
      console.error(
        `[FAIL] case4 ${orphans.length} products not covered by any card: ${orphans.slice(0, 10).join(', ')}`,
      )
      process.exit(1)
    }
    console.log(`[ok] case4 all ${registered.length} registered products map to >=1 mega menu card country`)

    const denmarkKeys = await resolveBrowseCardKeyToCountryKeys('nordic-baltic-cluster')
    if (!denmarkKeys.includes('denmark')) {
      console.error('[FAIL] nordic-baltic-cluster card missing denmark in MegaMenuGroupCardCountry')
      process.exit(1)
    }

    console.log('verify-browse-country-tag-geo: all passed')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
