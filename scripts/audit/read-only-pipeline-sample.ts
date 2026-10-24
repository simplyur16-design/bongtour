/**
 * READ ONLY: pick pipeline sample products and write tracking skeleton.
 * docs/audit/2026-10-24/pipeline-sample.json
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { databaseHostOnly, withReadOnlyPrisma } from './read-only-prisma'

/** Display names / aliases used in Product.originSource */
const SUPPLIER_ORIGINS: Record<string, string[]> = {
  hanatour: ['하나투어', 'hanatour'],
  modetour: ['모두투어', 'modetour'],
  ybtour: ['노랑풍선', 'ybtour', 'yellowballoon'],
  verygoodtour: ['참좋은여행', 'verygoodtour'],
  lottetour: ['롯데관광', 'lottetour'],
  kyowontour: ['교원투어', 'kyowontour'],
  naeiltour: ['내일투어', 'naeiltour'],
}

async function main() {
  const host = databaseHostOnly()
  console.log(`[audit] DB host=${host.host}`)

  const result = await withReadOnlyPrisma(async (tx) => {
    const bySupplier: Record<string, unknown[]> = {}
    for (const [key, aliases] of Object.entries(SUPPLIER_ORIGINS)) {
      const rows = await tx.product.findMany({
        where: {
          registrationStatus: 'registered',
          OR: aliases.map((a) => ({ originSource: { contains: a, mode: 'insensitive' as const } })),
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          originSource: true,
          originCode: true,
          originUrl: true,
          cityKey: true,
          countryKey: true,
          tripNights: true,
          tripDays: true,
          updatedAt: true,
          publicDetailPayloadBuiltAt: true,
          lastPriceObservedAt: true,
          _count: {
            select: {
              departures: true,
              countryTags: true,
              cityTags: true,
            },
          },
        },
      })
      bySupplier[key] = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title?.slice(0, 120),
        originSource: r.originSource,
        originCode: r.originCode,
        originUrlHost: r.originUrl
          ? (() => {
              try {
                return new URL(r.originUrl!).hostname
              } catch {
                return null
              }
            })()
          : null,
        cityKey: r.cityKey,
        countryKey: r.countryKey,
        tripNights: r.tripNights,
        tripDays: r.tripDays,
        departureCount: r._count.departures,
        countryTagCount: r._count.countryTags,
        cityTagCount: r._count.cityTags,
        updatedAt: r.updatedAt,
        publicDetailPayloadBuiltAt: r.publicDetailPayloadBuiltAt,
        lastPriceObservedAt: r.lastPriceObservedAt,
        payloadStaleHint:
          r.publicDetailPayloadBuiltAt && r.lastPriceObservedAt
            ? r.publicDetailPayloadBuiltAt < r.lastPriceObservedAt
            : null,
      }))
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = await tx.product.findMany({
      where: { registrationStatus: 'registered', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        originSource: true,
        originCode: true,
        cityKey: true,
        countryKey: true,
        createdAt: true,
      },
    })

    const multiCity = await tx.product.findMany({
      where: {
        registrationStatus: 'registered',
        cityTags: { some: {} },
      },
      take: 40,
      select: {
        id: true,
        slug: true,
        title: true,
        originSource: true,
        cityKey: true,
        countryKey: true,
        _count: { select: { cityTags: true, countryTags: true } },
      },
    })
    const multi = multiCity
      .filter((p) => p._count.cityTags >= 2 || p._count.countryTags >= 2)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title?.slice(0, 120),
        originSource: p.originSource,
        cityKey: p.cityKey,
        countryKey: p.countryKey,
        cityTagCount: p._count.cityTags,
        countryTagCount: p._count.countryTags,
      }))

    return { bySupplier, recent7d: recent, multiGeo: multi }
  })

  const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, 'pipeline-sample.json')
  writeFileSync(
    path,
    JSON.stringify({ generatedAt: new Date().toISOString(), host: host.host, ...result }, null, 2),
    'utf8',
  )
  console.log(`[audit] wrote ${path}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
