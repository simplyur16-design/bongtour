/**
 * registered 해외 상품 전체 — geo 필드 재추론 + ProductCountryTag/ProductCityTag 재동기화.
 * 메가메뉴·추천 여행지(시즌/페르소나 cityKey) browse 정합용.
 *
 *   npx tsx scripts/resync-all-mega-menu-geo.ts              # dry-run + 리포트
 *   npx tsx scripts/resync-all-mega-menu-geo.ts --apply        # DB 반영
 *   npx tsx scripts/resync-all-mega-menu-geo.ts --apply --limit=100
 */
import './load-env-for-scripts'

import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { syncProductGeoTags } from '@/lib/sync-product-geo-tags'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { buildOverseasBrowseGeoResolution } from '@/lib/browse-master-geo'
import { productMatchesBrowseUrlGeo } from '@/lib/match-overseas-product'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { citySlugFromTermsAndLabel, countrySlugFromLabel } from '@/lib/location-url-slugs'
import { MEGA_MENU_TAB_DEFINITIONS } from '@/lib/mega-menu-regions.data'
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'
import { getCurrentCycle } from '@/lib/season-curation'
import { resetMegaMenuSsotCityKeysCache } from '@/lib/mega-menu-ssot-city-keys'

const GEO_FIELDS = [
  'country',
  'city',
  'countryKey',
  'nodeKey',
  'groupKey',
  'continent',
  'continentKey',
  'cityKey',
  'locationMatchConfidence',
  'locationMatchSource',
] as const

function bodyTextFromSchedule(schedule: string | null): string | null {
  if (!schedule?.trim()) return null
  const rows = getScheduleFromProduct({ schedule })
  const t = rows
    .map((d) => [d.title, d.description].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
  return t.length ? t : null
}

function parseLimitArg(): number | null {
  const raw = process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]?.trim()
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

type ResyncRow = {
  id: string
  slug: string | null
  title: string
  beforeCityKeys: string[]
  afterCityKeys: string[]
  beforeCountryTags: string
  afterCountryTags: string
  geoChanged: boolean
}

async function auditMegaMenuCityCoverage(): Promise<
  Array<{ regionId: string; menuGroup: string; cityLabel: string; cityKey: string; browseCount: number }>
> {
  const rows: Array<{
    regionId: string
    menuGroup: string
    cityLabel: string
    cityKey: string
    browseCount: number
  }> = []

  for (const tab of MEGA_MENU_TAB_DEFINITIONS) {
    if (tab.localDeparture || !tab.groups.length) continue
    for (const group of tab.groups) {
      for (const leaf of group.cities) {
        if (leaf.kind !== 'city') continue
        const citySlug = citySlugFromTermsAndLabel(leaf.label, leaf.terms)
        const countrySlug = countrySlugFromLabel(group.headerBrowseCountryLabel ?? '일본')
        const geo = await buildOverseasBrowseGeoResolution({
          region: tab.id,
          country: countrySlug,
          city: citySlug,
          menuGroup: countrySlugFromLabel(group.countryLabel),
        })
        const count = await prisma.product.count({
          where: {
            registrationStatus: 'registered',
            travelScope: 'overseas',
            AND: geo.whereClauses,
          },
        })
        const ck = resolveBrowseCityKeysForFilter(citySlug)[0] ?? citySlug
        rows.push({
          regionId: tab.id,
          menuGroup: group.countryLabel,
          cityLabel: leaf.label,
          cityKey: ck,
          browseCount: count,
        })
      }
    }
  }
  return rows
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const limit = parseLimitArg()
  resetMegaMenuSsotCityKeysCache()

  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
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
      countryTags: {
        orderBy: { sortOrder: 'asc' },
        select: { countryKey: true, nodeKey: true },
      },
      cityTags: { select: { cityKey: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  })

  let domesticSkipped = 0
  const resynced: ResyncRow[] = []
  let applied = 0
  let tagOnly = 0
  let noCityTag = 0
  const inferredMismatch: Array<{ slug: string; title: string; inferred: string; tags: string }> = []

  for (const r of rows) {
    if (parseTravelScope(r.travelScope ?? undefined) === 'domestic') {
      domesticSkipped++
      continue
    }

    const beforeCityKeys = r.cityTags.map((t) => t.cityKey)
    const beforeCountryTags = r.countryTags
      .map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`)
      .join(', ')

    const bodyText = bodyTextFromSchedule(r.schedule)
    const { geo: next } = await normalizeProductGeoForPrisma(prisma, {
      title: r.title ?? '',
      originSource: r.originSource ?? '',
      destination: r.destination,
      destinationRaw: r.destinationRaw,
      primaryDestination: r.primaryDestination,
      bodyText,
      browseHintCountry: r.country,
      browseHintCity: r.city,
    })

    let geoChanged = false
    for (const k of GEO_FIELDS) {
      const oldV = (r as Record<string, unknown>)[k] ?? null
      const newV = (next as Record<string, unknown>)[k] ?? null
      if (oldV !== newV) geoChanged = true
    }

    if (apply) {
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
      })
      applied++
    }

    const after = apply
      ? await prisma.product.findUnique({
          where: { id: r.id },
          select: {
            cityTags: { select: { cityKey: true }, orderBy: { sortOrder: 'asc' } },
            countryTags: { select: { countryKey: true, nodeKey: true }, orderBy: { sortOrder: 'asc' } },
          },
        })
      : null

    const afterCityKeys = after?.cityTags.map((t) => t.cityKey) ?? beforeCityKeys
    const afterCountryTags =
      after?.countryTags.map((t) => `${t.countryKey}/${t.nodeKey ?? 'null'}`).join(', ') ??
      beforeCountryTags

    if (afterCityKeys.length === 0) noCityTag++

    const inferred = matchProductToOverseasNode({
      title: r.title,
      originSource: r.originSource ?? '',
      primaryDestination: r.primaryDestination,
      destinationRaw: r.destinationRaw,
    })
    const primaryTag = afterCityKeys[0] ?? next.cityKey ?? next.nodeKey
    if (
      inferred?.scope === 'leaf' &&
      inferred.leafKey &&
      primaryTag &&
      inferred.leafKey !== primaryTag &&
      !afterCityKeys.includes(inferred.leafKey)
    ) {
      inferredMismatch.push({
        slug: r.slug ?? r.id,
        title: r.title.slice(0, 80),
        inferred: `${inferred.countryKey}/${inferred.leafKey}`,
        tags: afterCityKeys.join(',') || '(none)',
      })
    }

    const tagsChanged =
      beforeCityKeys.join(',') !== afterCityKeys.join(',') ||
      beforeCountryTags !== afterCountryTags
    if (geoChanged || tagsChanged) {
      resynced.push({
        id: r.id,
        slug: r.slug,
        title: r.title,
        beforeCityKeys,
        afterCityKeys,
        beforeCountryTags,
        afterCountryTags,
        geoChanged,
      })
      if (!geoChanged && tagsChanged) tagOnly++
    }
  }

  const menuCoverage = await auditMegaMenuCityCoverage()
  const cycle = await getCurrentCycle(new Date())
  const heroCityKeys = [...(cycle?.cityKeys ?? []), ...(cycle?.fallbackKeys ?? [])].slice(0, 8)
  const heroCoverage: Array<{ cityKey: string; productCount: number }> = []
  for (const ck of heroCityKeys) {
    const n = await prisma.product.count({
      where: {
        registrationStatus: 'registered',
        travelScope: 'overseas',
        OR: [{ cityKey: ck }, { cityTags: { some: { cityKey: ck } } }],
      },
    })
    heroCoverage.push({ cityKey: ck, productCount: n })
  }

  const osakaGeo = await buildOverseasBrowseGeoResolution({
    region: 'japan',
    country: 'japan',
    city: 'osaka',
    menuGroup: '간사이',
  })
  const osakaBrowseCount = await prisma.product.count({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      AND: osakaGeo.whereClauses,
    },
  })
  const osakaProducts = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      AND: osakaGeo.whereClauses,
    },
    select: {
      title: true,
      slug: true,
      cityTags: { select: { cityKey: true } },
      countryTags: { select: { countryKey: true, nodeKey: true } },
    },
    take: 30,
  })
  const osakaFalsePositives = osakaProducts.filter((p) => {
    const tags = p.cityTags.map((t) => t.cityKey)
    const hasOsaka = tags.includes('osaka') || p.countryTags.some((t) => t.nodeKey === 'osaka')
    if (!hasOsaka) return true
    return !productMatchesBrowseUrlGeo(
      {
        title: p.title,
        originSource: '',
        countryTags: p.countryTags,
        cityTags: p.cityTags,
      },
      { region: 'japan', country: 'japan', city: 'osaka', regionCountryKeys: osakaGeo.regionCountryKeys },
    )
  })

  const report = {
    at: new Date().toISOString(),
    apply,
    scanned: rows.length,
    domesticSkipped,
    changed: resynced.length,
    applied,
    tagOnly,
    noCityTag,
    inferredMismatchCount: inferredMismatch.length,
    inferredMismatchSample: inferredMismatch.slice(0, 40),
    heroCoverage,
    menuCoverageSample: menuCoverage.filter((m) => m.regionId === 'japan').slice(0, 20),
    osakaBrowseCount,
    osakaFalsePositiveSample: osakaFalsePositives.slice(0, 10).map((p) => ({
      slug: p.slug,
      title: p.title.slice(0, 60),
      cityTags: p.cityTags.map((t) => t.cityKey),
    })),
    changesSample: resynced.slice(0, 50),
  }

  const outDir = path.join(process.cwd(), 'scripts', 'data')
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `resync-mega-menu-geo-${Date.now()}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(JSON.stringify(report, null, 2))
  console.log(`\n[resync-all-mega-menu-geo] report → ${outPath}`)
  if (!apply) {
    console.log('\n[dry-run] DB 반영: npx tsx scripts/resync-all-mega-menu-geo.ts --apply')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
