/**
 * fit-hn-0010(런던 카드 이미지) · fit-yb-0005(세부→유럽 오분류) 일회성 보정.
 *
 *   npx tsx scripts/ops-fix-fit-hn-yb-products.ts           # dry-run
 *   npx tsx scripts/ops-fix-fit-hn-yb-products.ts --apply
 */
import './load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import { deriveTreeGeoFromMasterPrimary } from '@/lib/geo-audit-tree-from-master'
import { getPoolPhotosForDestination } from '@/lib/photo-pool'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

const APPLY = process.argv.includes('--apply')

async function fixYb0005Geo() {
  const product = await prisma.product.findFirst({
    where: { slug: 'fit-yb-0005' },
    select: {
      id: true,
      slug: true,
      title: true,
      primaryDestination: true,
      destination: true,
      destinationRaw: true,
      countryKey: true,
      cityKey: true,
    },
  })
  if (!product) {
    console.log('[fit-yb-0005] not found')
    return
  }

  const countryKey = 'philippines'
  const cityKey = 'cebu'
  const tree = deriveTreeGeoFromMasterPrimary(countryKey, cityKey)
  const city = await prisma.city.findUnique({
    where: { cityKey },
    select: { koreanLabel: true },
  })
  const country = await prisma.country.findUnique({
    where: { countryKey },
    select: { koreanLabel: true, continentKey: true },
  })

  console.log('[fit-yb-0005] before', {
    countryKey: product.countryKey,
    cityKey: product.cityKey,
  })
  console.log('[fit-yb-0005] after', {
    countryKey,
    cityKey,
    continentKey: country?.continentKey,
    country: country?.koreanLabel,
    city: city?.koreanLabel,
    groupKey: tree.groupKey,
    nodeKey: tree.nodeKey,
  })

  if (!APPLY) return

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: {
        countryKey,
        cityKey,
        nodeKey: tree.nodeKey,
        groupKey: tree.groupKey ?? undefined,
        continentKey: country?.continentKey ?? undefined,
        continent: tree.continent ?? undefined,
        country: country?.koreanLabel ?? '필리핀',
        city: city?.koreanLabel ?? '세부',
        locationMatchConfidence: 'high',
        locationMatchSource: 'ops-fix-fit-hn-yb-products',
        lastGeoAuditAt: new Date(),
        geoAuditLastPatchJson: JSON.stringify({
          action: 'cebu_island_not_ireland',
          at: new Date().toISOString(),
          fromCountryKey: product.countryKey,
          fromCityKey: product.cityKey,
        }),
      },
    })
    await tx.productCountryTag.deleteMany({
      where: { productId: product.id, countryKey: 'ireland' },
    })
    await tx.productCityTag.deleteMany({
      where: { productId: product.id, cityKey: 'ireland-mix' },
    })
  })

  await syncProductGeoTags(prisma, product.id, {
    countryKey,
    cityKey,
    nodeKey: tree.nodeKey,
    groupKey: tree.groupKey,
    continentKey: country?.continentKey ?? null,
  }, {
    title: product.title,
    primaryDestination: product.primaryDestination,
    destinationRaw: product.destinationRaw,
  })

  console.log('[fit-yb-0005] applied')
}

async function fixHn0010Images() {
  const product = await prisma.product.findFirst({
    where: { slug: 'fit-hn-0010' },
    select: {
      id: true,
      slug: true,
      destination: true,
      primaryDestination: true,
      schedule: true,
      bgImageUrl: true,
    },
  })
  if (!product?.schedule) {
    console.log('[fit-hn-0010] not found or no schedule')
    return
  }

  const destination = (product.primaryDestination ?? product.destination ?? '').trim()
  const poolList = await getPoolPhotosForDestination(prisma, destination)
  console.log('[fit-hn-0010] destination', destination, 'pool', poolList.length, 'bg', product.bgImageUrl)

  if (poolList.length < 5) {
    console.log('[fit-hn-0010] pool < 5 — process-images 수동 필요')
    return
  }

  const schedule = JSON.parse(product.schedule) as Record<string, unknown>[]
  const mainUrl = poolList[0]!.filePath
  const updated = schedule.map((item, i) => {
    const rec = poolList[i + 1]
    return {
      ...item,
      imageUrl: rec?.filePath ?? item.imageUrl ?? null,
      imageSource: rec
        ? { source: rec.source ?? 'pexels', photographer: rec.source ?? null, originalLink: '' }
        : item.imageSource ?? null,
    }
  })

  console.log('[fit-hn-0010] would set bg', mainUrl.slice(0, 80))
  console.log('[fit-hn-0010] schedule images', updated.filter((d) => d.imageUrl).length)

  if (!APPLY) return

  await prisma.product.update({
    where: { id: product.id },
    data: {
      bgImageUrl: mainUrl,
      bgImageSourceType: 'pexels',
      schedule: JSON.stringify(updated),
      publicDetailPayloadJson: null,
      publicDetailPayloadBuiltAt: null,
    },
  })
  console.log('[fit-hn-0010] applied')
}

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY-RUN ===')
  await fixYb0005Geo()
  await fixHn0010Images()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
