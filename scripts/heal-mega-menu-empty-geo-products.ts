/**
 * Heal registered overseas products with empty/wrong destination labels or missing city tags
 * that block mega-menu leaf browse.
 *
 *   npx tsx scripts/heal-mega-menu-empty-geo-products.ts --dry-run
 *   npx tsx scripts/heal-mega-menu-empty-geo-products.ts --apply
 */
import './load-env-for-scripts'

import { prisma } from '@/lib/prisma'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'

const APPLY = process.argv.includes('--apply')

type Heal = {
  slug: string
  reason: string
  primaryDestination?: string
  destinationRaw?: string
  addCityKeys?: string[]
}

function scheduleHay(schedule: string | null): string {
  if (!schedule?.trim()) return ''
  return getScheduleFromProduct({ schedule })
    .map((d) => [d.title, d.description, d.routeText].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
}

async function ensureCityTags(productId: string, cityKeys: string[]): Promise<void> {
  const existing = await prisma.productCityTag.findMany({
    where: { productId },
    select: { cityKey: true, sortOrder: true },
  })
  const have = new Set(existing.map((r) => r.cityKey))
  let sortOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1
  for (const cityKey of cityKeys) {
    const k = cityKey.trim().toLowerCase()
    if (!k || have.has(k)) continue
    await prisma.productCityTag.create({
      data: { productId, cityKey: k, isPrimary: existing.length === 0 && sortOrder === 0, sortOrder },
    })
    have.add(k)
    sortOrder += 1
  }
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
      slug: true,
      title: true,
      travelScope: true,
      primaryDestination: true,
      destinationRaw: true,
      schedule: true,
      countryKey: true,
      cityKey: true,
      nodeKey: true,
      groupKey: true,
      countryTags: { select: { countryKey: true } },
      cityTags: { select: { cityKey: true } },
    },
  })

  const heals: Heal[] = []
  for (const p of rows) {
    if (parseTravelScope(p.travelScope ?? undefined) === 'domestic') continue
    const pd = (p.primaryDestination ?? '').trim()
    const dr = (p.destinationRaw ?? '').trim()
    const title = p.title ?? ''
    const hay = `${title}\n${pd}\n${dr}\n${scheduleHay(p.schedule)}`
    const cityKeys = new Set(p.cityTags.map((t) => t.cityKey))

    if ((!pd || pd === '미지정') && (!dr || dr === '미지정')) {
      if (/독일|스위스|오스트리아/.test(title)) {
        heals.push({
          slug: p.slug ?? p.id,
          reason: 'empty-dest-europe-welfare',
          primaryDestination: '독일 · 스위스 · 오스트리아',
          destinationRaw: '유럽',
        })
      }
    }

    if (/마츠모토/.test(hay) && !cityKeys.has('matsumoto') && p.countryTags.some((t) => t.countryKey === 'japan')) {
      heals.push({ slug: p.slug ?? p.id, reason: 'add-matsumoto', addCityKeys: ['matsumoto'] })
    }
    if (
      /요세미티|샌프란|san\s*francisco|3대도시/.test(hay) &&
      !cityKeys.has('sf') &&
      (p.countryTags.some((t) => t.countryKey === 'united-states') || cityKeys.has('la') || cityKeys.has('lasvegas'))
    ) {
      heals.push({ slug: p.slug ?? p.id, reason: 'add-sf', addCityKeys: ['sf'] })
    }
    if (/토론토|toronto/.test(hay) && !cityKeys.has('toronto')) {
      heals.push({ slug: p.slug ?? p.id, reason: 'add-toronto', addCityKeys: ['toronto'] })
    }
    if (/퀘벡|quebec|몬트리올|montreal/.test(hay) && !cityKeys.has('quebec')) {
      heals.push({ slug: p.slug ?? p.id, reason: 'add-quebec', addCityKeys: ['quebec'] })
    }
    if (
      p.slug === 'pkg-ky-0021' &&
      p.countryTags.some((t) => t.countryKey === 'taiwan') &&
      cityKeys.size === 0
    ) {
      heals.push({
        slug: p.slug,
        reason: 'taiwan-empty-city',
        primaryDestination: pd || '대만 타이베이',
        destinationRaw: dr || '대만',
        addCityKeys: ['taipei'],
      })
    }
    if (
      p.slug === 'pkg-mt-0082' &&
      p.countryTags.some((t) => t.countryKey === 'china') &&
      cityKeys.size === 0
    ) {
      // 정주·낙양 마스터 cityKey 없음 — destination만 보강 후 sync에 맡김
      heals.push({
        slug: p.slug,
        reason: 'china-zhengzhou-dest',
        primaryDestination: pd || '중국 정주',
        destinationRaw: dr || '중국',
      })
    }
    if (
      p.slug === 'pkg-ky-0017' &&
      cityKeys.size === 0 &&
      p.countryTags.some((t) => ['uzbekistan', 'kazakhstan', 'kyrgyzstan'].includes(t.countryKey))
    ) {
      heals.push({
        slug: p.slug,
        reason: 'central-asia-empty-city-ok',
        // country tags already present; city optional for multi-country cluster
      })
    }
  }

  // de-dupe by slug+reason
  const uniq = new Map<string, Heal>()
  for (const h of heals) {
    const key = `${h.slug}::${h.reason}`
    const prev = uniq.get(key)
    if (!prev) {
      uniq.set(key, h)
      continue
    }
    uniq.set(key, {
      ...prev,
      ...h,
      addCityKeys: [...new Set([...(prev.addCityKeys ?? []), ...(h.addCityKeys ?? [])])],
    })
  }
  const list = [...uniq.values()].filter((h) => h.primaryDestination || h.destinationRaw || (h.addCityKeys?.length ?? 0) > 0)

  console.log(JSON.stringify({ apply: APPLY, count: list.length, sample: list }, null, 2))

  if (!APPLY) {
    console.log('\n[dry-run] apply: npx tsx scripts/heal-mega-menu-empty-geo-products.ts --apply')
    await prisma.$disconnect()
    return
  }

  for (const h of list) {
    const p = rows.find((r) => (r.slug ?? r.id) === h.slug)
    if (!p) continue
    if (h.primaryDestination || h.destinationRaw) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          ...(h.primaryDestination ? { primaryDestination: h.primaryDestination } : {}),
          ...(h.destinationRaw ? { destinationRaw: h.destinationRaw } : {}),
        },
      })
    }
    if (h.addCityKeys?.length) {
      await ensureCityTags(p.id, h.addCityKeys)
    }
    const refreshed = await prisma.product.findUniqueOrThrow({
      where: { id: p.id },
      select: {
        title: true,
        primaryDestination: true,
        destinationRaw: true,
        countryKey: true,
        cityKey: true,
        nodeKey: true,
        groupKey: true,
      },
    })
    await syncProductGeoTags(
      prisma,
      p.id,
      {
        countryKey: refreshed.countryKey,
        cityKey: refreshed.cityKey,
        nodeKey: refreshed.nodeKey,
        groupKey: refreshed.groupKey,
        continent: null,
        continentKey: null,
        country: null,
        city: null,
        locationMatchConfidence: null,
        locationMatchSource: null,
      },
      {
        title: refreshed.title ?? '',
        primaryDestination: refreshed.primaryDestination,
        destinationRaw: refreshed.destinationRaw,
        scheduleHaystack: scheduleHay(p.schedule) || null,
      },
    )
    if (h.addCityKeys?.length) {
      // sync may rewrite city tags — re-ensure explicit keys
      await ensureCityTags(p.id, h.addCityKeys)
    }
    console.warn(`[heal] ${h.slug}: ${h.reason}`)
  }

  console.log(`\n[heal-mega-menu-empty-geo-products] applied ${list.length}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
