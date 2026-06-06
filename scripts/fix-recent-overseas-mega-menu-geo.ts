/**
 * 최근 등록·갱신 해외 상품 — 메가메뉴 geo 점검 + 재동기화.
 *
 * npx tsx scripts/fix-recent-overseas-mega-menu-geo.ts
 * npx tsx scripts/fix-recent-overseas-mega-menu-geo.ts --apply
 * npx tsx scripts/fix-recent-overseas-mega-menu-geo.ts --apply --days=30
 */
import './load-env-for-scripts'

import { prisma } from '@/lib/prisma'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { buildRegisterGeoHaystackFromSchedule } from '@/lib/register-geo-schedule-haystack'
import { buildBrowseUrlGeoForMegaMenuCityKey } from '@/lib/mega-menu-city-browse-href'
import { productMatchesBrowseUrlGeo } from '@/lib/match-overseas-product'
import { declaredCountryCountFromTitle, detectMultiCountryAutoPlan } from '@/lib/normalize-product-geo-master'
import { resetMegaMenuSsotCityKeysCache } from '@/lib/mega-menu-ssot-city-keys'
import { resetMegaMenuCityPlacementCache } from '@/lib/mega-menu-city-group-coherence'

const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 21)
const apply = process.argv.includes('--apply')

function sinceDate(): Date {
  const d = new Date()
  d.setDate(d.getDate() - DAYS)
  return d
}

type Issue = { slug: string; kind: string; detail: string }

async function auditProduct(p: {
  slug: string | null
  title: string
  primaryDestination: string | null
  destinationRaw: string | null
  continentKey: string | null
  countryKey: string | null
  cityKey: string | null
  countryTags: Array<{ countryKey: string; nodeKey: string | null }>
  cityTags: Array<{ cityKey: string; isPrimary: boolean }>
}): Promise<Issue[]> {
  const slug = p.slug ?? 'unknown'
  const issues: Issue[] = []
  const tagStr = p.countryTags.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ')

  if (!p.continentKey || !p.countryKey) {
    issues.push({ slug, kind: 'missing_primary_geo', detail: `${p.continentKey}/${p.countryKey}/${p.cityKey}` })
  }
  if (p.countryTags.length === 0) {
    issues.push({ slug, kind: 'missing_country_tags', detail: p.title.slice(0, 80) })
  }
  if (p.cityKey && p.cityTags.length === 0) {
    issues.push({ slug, kind: 'missing_city_tags', detail: `cityKey=${p.cityKey}` })
  }

  const declaredN = declaredCountryCountFromTitle(p.title)
  if (declaredN && declaredN >= 2) {
    const plan = await detectMultiCountryAutoPlan(
      prisma,
      {
        title: p.title,
        primaryDestination: p.primaryDestination,
        destinationRaw: p.destinationRaw,
      },
      p.countryKey,
    )
    if (plan.kind === 'multi') {
      const have = new Set(p.countryTags.map((t) => t.countryKey))
      const missing = plan.countryKeys.filter((k) => !have.has(k))
      if (missing.length > 0) {
        issues.push({
          slug,
          kind: 'multi_country_missing',
          detail: `missing=[${missing.join(',')}] tags=${tagStr}`,
        })
      }
    }
  }

  const primaryCity = p.cityTags.find((t) => t.isPrimary)?.cityKey ?? p.cityTags[0]?.cityKey ?? p.cityKey
  if (primaryCity) {
    const urlGeo = await buildBrowseUrlGeoForMegaMenuCityKey(primaryCity)
    if (urlGeo) {
      const ok = productMatchesBrowseUrlGeo(
        {
          countryKey: p.countryKey,
          cityKey: p.cityKey,
          countryTags: p.countryTags,
          cityTags: p.cityTags,
        },
        urlGeo,
      )
      if (!ok) {
        issues.push({ slug, kind: 'browse_mismatch', detail: `primary=${primaryCity} tags=${tagStr}` })
      }
    }
  }

  if (p.continentKey === 'oceania' && p.countryTags.some((t) => t.countryKey === 'spain')) {
    issues.push({ slug, kind: 'cross_continent_tag', detail: `oceania product has spain tag: ${tagStr}` })
  }

  return issues
}

async function main() {
  resetMegaMenuSsotCityKeysCache()
  resetMegaMenuCityPlacementCache()

  const rows = await prisma.product.findMany({
    where: {
      updatedAt: { gte: sinceDate() },
      OR: [{ travelScope: 'overseas' }, { travelScope: null }],
      registrationStatus: { in: ['registered', 'pending'] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      originSource: true,
      destination: true,
      destinationRaw: true,
      primaryDestination: true,
      schedule: true,
      travelScope: true,
      country: true,
      city: true,
      countryKey: true,
      nodeKey: true,
      groupKey: true,
      continent: true,
      continentKey: true,
      cityKey: true,
      locationMatchConfidence: true,
      locationMatchSource: true,
      countryTags: { orderBy: { sortOrder: 'asc' } },
      cityTags: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const overseas = rows.filter((r) => parseTravelScope(r.travelScope ?? undefined) !== 'domestic')
  console.log(`[fix-recent-mega-menu-geo] days=${DAYS} overseas=${overseas.length} apply=${apply}`)

  const issuesBefore: Issue[] = []
  for (const p of overseas) {
    issuesBefore.push(...(await auditProduct({ ...p, slug: p.slug })))
  }

  let fixed = 0
  const changes: Array<{ slug: string; before: string; after: string }> = []

  for (const r of overseas) {
    const beforeTags = r.countryTags.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ')
    const beforeCities = r.cityTags.map((t) => t.cityKey).join(', ')

    const scheduleRows = getScheduleFromProduct({ schedule: r.schedule })
    const scheduleHaystack = buildRegisterGeoHaystackFromSchedule(scheduleRows)

    const { geo: next } = await normalizeProductGeoForPrisma(prisma, {
      title: r.title ?? '',
      originSource: r.originSource ?? '',
      destination: r.destination,
      destinationRaw: r.destinationRaw,
      primaryDestination: r.primaryDestination,
      bodyText: scheduleHaystack,
      browseHintCountry: r.country,
      browseHintCity: r.city,
    })

    if (!apply) continue

    await prisma.product.update({
      where: { id: r.id },
      data: {
        country: next.country,
        city: next.city,
        countryKey: next.countryKey,
        nodeKey: next.nodeKey,
        groupKey: next.groupKey,
        continent: next.continent,
        continentKey: next.continentKey,
        cityKey: next.cityKey,
        locationMatchConfidence: next.locationMatchConfidence,
        locationMatchSource: next.locationMatchSource,
      },
    })

    await syncProductGeoTags(prisma, r.id, next, {
      title: r.title ?? '',
      primaryDestination: r.primaryDestination,
      destinationRaw: r.destinationRaw,
      scheduleHaystack,
    })

    const after = await prisma.product.findUnique({
      where: { id: r.id },
      select: {
        countryTags: { orderBy: { sortOrder: 'asc' } },
        cityTags: { orderBy: { sortOrder: 'asc' } },
      },
    })
    const afterTags = after?.countryTags.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ') ?? ''
    const afterCities = after?.cityTags.map((t) => t.cityKey).join(', ') ?? ''

    if (beforeTags !== afterTags || beforeCities !== afterCities) {
      changes.push({
        slug: r.slug ?? r.id,
        before: `${beforeTags} | cities: ${beforeCities}`,
        after: `${afterTags} | cities: ${afterCities}`,
      })
    }
    fixed++
  }

  const issuesAfter: Issue[] = []
  if (apply) {
    for (const r of overseas) {
      const fresh = await prisma.product.findUnique({
        where: { id: r.id },
        select: {
          slug: true,
          title: true,
          primaryDestination: true,
          destinationRaw: true,
          continentKey: true,
          countryKey: true,
          cityKey: true,
          countryTags: { orderBy: { sortOrder: 'asc' } },
          cityTags: { orderBy: { sortOrder: 'asc' } },
        },
      })
      if (fresh) issuesAfter.push(...(await auditProduct(fresh)))
    }
  }

  console.log(`\n--- issues before: ${issuesBefore.length} ---`)
  for (const i of issuesBefore) console.log(`[${i.slug}] ${i.kind}: ${i.detail}`)

  if (apply) {
    console.log(`\n--- tag changes (${changes.length}) ---`)
    for (const c of changes) {
      console.log(`${c.slug}`)
      console.log(`  before: ${c.before}`)
      console.log(`  after:  ${c.after}`)
    }
    console.log(`\n--- issues after: ${issuesAfter.length} ---`)
    for (const i of issuesAfter) console.log(`[${i.slug}] ${i.kind}: ${i.detail}`)
    console.log(`\n[fix-recent-mega-menu-geo] resynced=${fixed}`)
  } else {
    console.log('\n[fix-recent-mega-menu-geo] dry-run — pass --apply to persist')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
