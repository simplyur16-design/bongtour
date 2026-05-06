/**
 * I-3: 등록·해외 상품에 SSOT `Product.continentKey` / `Product.cityKey` 자동 백필.
 * ProductCountryTag / ProductCityTag 는 삽입하지 않는다.
 *
 *   npx tsx scripts/backfill-product-master.ts           # dry-run (기본)
 *   npx tsx scripts/backfill-product-master.ts --apply     # DB 반영
 */
import './load-env-for-scripts'

import { prisma } from '@/lib/prisma'
import {
  looksLikeChaosRegionLabel,
  mapTreeKeysToMasterKeys,
  titleSuggestsMultiCountryPackage,
} from '@/lib/product-master-mapping'

const ASCII_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/i

function hasHangul(s: string | null | undefined): boolean {
  return typeof s === 'string' && /[가-힣]/.test(s)
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim()
}

type PatchRow = {
  id: string
  originSource: string
  originCode: string
  title: string
  before: {
    continentKey: string | null
    cityKey: string | null
    groupKey: string | null
    countryKey: string | null
    nodeKey: string | null
    country: string | null
    city: string | null
  }
  after: { continentKey: string | null; cityKey: string | null }
  operatorQueue: boolean
  primaryReason: string
  allReasons: string[]
}

function pickPrimaryOperatorReason(flags: string[]): string {
  const order = [
    'title_multi_country',
    'chaos_region_label',
    'theme_route_leaf',
    'theme_or_multi_country_tree',
    'ambiguous_multi_country_leaf',
    'latin_multi_country_leaf',
    'balkans_bundle',
    'tree_country_requires_nodekey',
    'missing_tree_country',
    'unknown_group',
    'fk_city_not_in_master',
    'fk_continent_not_in_master',
    'fk_country_not_in_master',
    'city_country_mismatch',
    'incomplete_keys_after_enrichment',
    'multi_city_cluster',
  ]
  for (const o of order) {
    if (flags.includes(o)) return o
  }
  return flags[0] ?? 'operator_review'
}

async function main() {
  const apply = process.argv.includes('--apply')

  const [countries, cities, continentRows] = await Promise.all([
    prisma.country.findMany({
      select: { countryKey: true, continentKey: true, koreanLabel: true },
    }),
    prisma.city.findMany({
      select: { cityKey: true, countryKey: true, koreanLabel: true },
    }),
    prisma.continent.findMany({ select: { continentKey: true } }),
  ])

  const continentKeySet = new Set(continentRows.map((c) => c.continentKey))
  const countryRow = new Map(countries.map((c) => [c.countryKey, c]))
  const cityRow = new Map(cities.map((c) => [c.cityKey, c]))
  const countryByKorean = new Map<string, string>()
  for (const c of countries) {
    const lb = c.koreanLabel.trim()
    if (!countryByKorean.has(lb)) countryByKorean.set(lb, c.countryKey)
  }

  const citiesByKorean = new Map<string, Array<{ cityKey: string; countryKey: string }>>()
  for (const c of cities) {
    const lb = c.koreanLabel.trim()
    const arr = citiesByKorean.get(lb) ?? []
    arr.push({ cityKey: c.cityKey, countryKey: c.countryKey })
    citiesByKorean.set(lb, arr)
  }

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
    },
    select: {
      id: true,
      title: true,
      originSource: true,
      originCode: true,
      groupKey: true,
      countryKey: true,
      nodeKey: true,
      continentKey: true,
      cityKey: true,
      country: true,
      city: true,
      destinationRaw: true,
      primaryDestination: true,
    },
    orderBy: { id: 'asc' },
  })

  const applyRows: PatchRow[] = []
  const operatorRows: PatchRow[] = []
  const reasonBuckets = new Map<string, number>()
  let skippedAlreadyFilled = 0

  for (const p of products) {
    if (p.continentKey && p.cityKey) {
      skippedAlreadyFilled++
      continue
    }

    const tree = mapTreeKeysToMasterKeys({
      groupKey: p.groupKey,
      countryKey: p.countryKey,
      nodeKey: p.nodeKey,
    })

    let continentKey = p.continentKey ?? tree.continentKey
    let masterCountryKey = tree.masterCountryKey
    let cityKey = p.cityKey ?? tree.cityKey

    const flags: string[] = [...tree.reasons]

    if (titleSuggestsMultiCountryPackage(p.title)) flags.push('title_multi_country')

    const browseCountry = norm(p.country)

    if (!masterCountryKey && browseCountry) {
      if (ASCII_SLUG.test(browseCountry) && countryRow.has(browseCountry)) {
        masterCountryKey = browseCountry
      } else if (hasHangul(browseCountry)) {
        const hit = countryByKorean.get(browseCountry)
        if (hit) masterCountryKey = hit
      }
    }

    if (!continentKey && masterCountryKey) {
      continentKey = countryRow.get(masterCountryKey)?.continentKey ?? null
    }

    const browseCity = norm(p.city)
    if (!cityKey && masterCountryKey && browseCity) {
      if (ASCII_SLUG.test(browseCity)) {
        const crow = cityRow.get(browseCity)
        if (crow?.countryKey === masterCountryKey) cityKey = browseCity
      } else if (hasHangul(browseCity)) {
        const cands = (citiesByKorean.get(browseCity) ?? []).filter(
          (x) => x.countryKey === masterCountryKey,
        )
        if (cands.length === 1) cityKey = cands[0]!.cityKey
      }
    }

    for (const hang of [norm(p.destinationRaw), norm(p.primaryDestination)]) {
      if (cityKey || !masterCountryKey || !hasHangul(hang)) continue
      if (hang === browseCountry) continue
      const cands = (citiesByKorean.get(hang) ?? []).filter(
        (x) => x.countryKey === masterCountryKey,
      )
      if (cands.length === 1) cityKey = cands[0]!.cityKey
    }

    if (continentKey && !continentKeySet.has(continentKey)) {
      flags.push('fk_continent_not_in_master')
      continentKey = null
    }

    if (cityKey) {
      const c = cityRow.get(cityKey)
      if (!c) {
        flags.push('fk_city_not_in_master')
        cityKey = null
      } else if (masterCountryKey && c.countryKey !== masterCountryKey) {
        flags.push('city_country_mismatch')
        cityKey = null
      }
    }

    if (masterCountryKey && !countryRow.has(masterCountryKey)) {
      flags.push('fk_country_not_in_master')
      masterCountryKey = null
    }

    const afterContinent = p.continentKey ?? continentKey
    const afterCity = p.cityKey ?? cityKey

    const complete =
      !!afterContinent &&
      !!afterCity &&
      !flags.includes('fk_continent_not_in_master') &&
      !flags.includes('fk_city_not_in_master')

    const chaosBrowse =
      hasHangul(browseCountry) && looksLikeChaosRegionLabel(browseCountry)
    if (chaosBrowse) flags.push('chaos_region_label')
    if (!complete && !flags.includes('incomplete_keys_after_enrichment'))
      flags.push('incomplete_keys_after_enrichment')

    const hardOperator =
      flags.includes('title_multi_country') ||
      flags.includes('chaos_region_label') ||
      flags.includes('theme_route_leaf') ||
      flags.includes('theme_or_multi_country_tree') ||
      flags.includes('ambiguous_multi_country_leaf') ||
      flags.includes('latin_multi_country_leaf') ||
      flags.includes('balkans_bundle') ||
      flags.includes('tree_country_requires_nodekey') ||
      flags.includes('missing_tree_country') ||
      flags.includes('unknown_group') ||
      flags.includes('fk_country_not_in_master') ||
      flags.includes('city_country_mismatch') ||
      !complete

    const operator = hardOperator
    const primaryReason = operator ? pickPrimaryOperatorReason(flags) : 'auto_fix'
    if (operator) {
      reasonBuckets.set(primaryReason, (reasonBuckets.get(primaryReason) ?? 0) + 1)
    }

    const row: PatchRow = {
      id: p.id,
      originSource: p.originSource,
      originCode: p.originCode,
      title: p.title,
      before: {
        continentKey: p.continentKey,
        cityKey: p.cityKey,
        groupKey: p.groupKey,
        countryKey: p.countryKey,
        nodeKey: p.nodeKey,
        country: p.country,
        city: p.city,
      },
      after: { continentKey: afterContinent, cityKey: afterCity },
      operatorQueue: operator,
      primaryReason,
      allReasons: [...new Set(flags)],
    }

    if (!operator) applyRows.push(row)
    else operatorRows.push(row)
  }

  console.log('[I-3 backfill] registered+overseas 대상:', products.length, '건')
  console.log('[I-3 backfill] continent+city 이미 있음(스킵):', skippedAlreadyFilled, '건')
  console.log('[I-3 backfill] 자동 반영 대상(autoFix):', applyRows.length, '건')
  console.log('[I-3 backfill] 운영자 큐:', operatorRows.length, '건')
  console.log('[I-3 backfill] 운영자 큐 사유별:')
  for (const [k, v] of [...reasonBuckets.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`)
  }

  const sample = [...applyRows, ...operatorRows].slice(0, 80)
  console.log('\n[I-3 backfill] 샘플 (최대 80행, before → after):')
  for (const s of sample) {
    console.log(
      JSON.stringify(
        {
          id: s.id,
          origin: `${s.originSource}:${s.originCode}`,
          title: s.title.slice(0, 60),
          before: s.before,
          after: s.after,
          operatorQueue: s.operatorQueue,
          primaryReason: s.primaryReason,
          reasons: s.allReasons,
        },
        null,
        0,
      ),
    )
  }

  console.log(`
[I-3 검증용 SQL]
SELECT COUNT(*) AS continent_filled FROM "Product" WHERE "continentKey" IS NOT NULL;
SELECT COUNT(*) AS city_filled FROM "Product" WHERE "cityKey" IS NOT NULL;
SELECT id, "originSource", "originCode", title FROM "Product"
  WHERE "registrationStatus" = 'registered' AND "travelScope" = 'overseas'
  AND ("continentKey" IS NULL OR "cityKey" IS NULL);
`)

  if (apply) {
    let n = 0
    for (const row of applyRows) {
      await prisma.product.update({
        where: { id: row.id },
        data: {
          continentKey: row.after.continentKey,
          cityKey: row.after.cityKey,
        },
      })
      n++
    }
    console.log('[I-3 backfill] APPLY 완료:', n, '건 업데이트')
  } else {
    console.log('[I-3 backfill] dry-run만 수행. 반영하려면 --apply')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
