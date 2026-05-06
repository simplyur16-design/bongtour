/**
 * D-3 백필: 등록 상품 `country`/`city` 한글 SSOT + 키·continent 재추론 (`normalizeProductGeoForPrisma`).
 *
 *   npx tsx scripts/backfill-product-geo-d3.ts                    # dry-run 전체
 *   npx tsx scripts/backfill-product-geo-d3.ts --apply-a-only      # 안전 A만 dry-run + B 인계 JSON
 *   npx tsx scripts/backfill-product-geo-d3.ts --apply             # 전체 diff DB 반영
 *   npx tsx scripts/backfill-product-geo-d3.ts --apply-a-only --apply  # A만 DB 반영
 *
 * 국내(`travelScope === 'domestic'`) 상품은 스킵(해외 browse·메가메뉴 SSOT 대상 아님).
 */
import './load-env-for-scripts'

import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { prisma } from '@/lib/prisma'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

function bodyTextFromSchedule(schedule: string | null): string | null {
  if (!schedule?.trim()) return null
  const rows = getScheduleFromProduct({ schedule })
  const t = rows
    .map((d) => [d.title, d.description].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
  return t.length ? t : null
}

const GEO_FIELDS = [
  'country',
  'city',
  'countryKey',
  'nodeKey',
  'groupKey',
  'continent',
  'locationMatchConfidence',
  'locationMatchSource',
] as const

const ASCII_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/i

function hasHangul(s: unknown): boolean {
  return typeof s === 'string' && /[가-힣]/.test(s)
}

function isAsciiSlug(s: unknown): boolean {
  return typeof s === 'string' && ASCII_SLUG.test(s.trim())
}

/** D-3-RUN-V2 “A”: 키만 비어 있고 한글 browse + normalize high + 결과 표기도 한글만 */
function isCategoryA(
  before: { country: unknown; city: unknown; countryKey: unknown },
  after: { country: unknown; city: unknown; locationMatchConfidence: unknown },
): boolean {
  if (before.countryKey != null) return false
  if (!hasHangul(before.country)) return false
  if (isAsciiSlug(before.country)) return false
  if (before.city != null && String(before.city).trim() !== '') {
    if (!hasHangul(before.city)) return false
    if (isAsciiSlug(before.city)) return false
  }
  if (after.locationMatchConfidence !== 'high') return false
  if (!hasHangul(after.country)) return false
  if (after.city != null && String(after.city).trim() !== '') {
    if (!hasHangul(after.city)) return false
    if (isAsciiSlug(after.city)) return false
  }
  return true
}

function bCategoryReasons(
  before: { country: unknown; city: unknown; countryKey: unknown },
  after: { country: unknown; city: unknown; locationMatchConfidence: unknown },
): string[] {
  const r: string[] = []
  if (before.countryKey != null) r.push('countryKey_already_set')
  if (!hasHangul(before.country)) r.push('before_country_not_hangul')
  if (isAsciiSlug(before.country)) r.push('before_country_ascii_slug')
  if (before.city != null && String(before.city).trim() !== '') {
    if (!hasHangul(before.city)) r.push('before_city_not_hangul')
    if (isAsciiSlug(before.city)) r.push('before_city_ascii_slug')
  }
  if (after.locationMatchConfidence !== 'high') r.push('confidence_not_high')
  if (!hasHangul(after.country)) r.push('after_country_not_hangul')
  if (after.city != null && String(after.city).trim() !== '') {
    if (!hasHangul(after.city)) r.push('after_city_not_hangul')
    if (isAsciiSlug(after.city)) r.push('after_city_ascii_slug')
  }
  return r
}

type Patch = {
  id: string
  originSource: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

async function main() {
  const apply = process.argv.includes('--apply')
  const applyAOnly = process.argv.includes('--apply-a-only')

  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
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
      locationMatchConfidence: true,
      locationMatchSource: true,
    },
  })

  let domesticSkipped = 0
  const patches: Patch[] = []

  for (const r of rows) {
    if (parseTravelScope(r.travelScope ?? undefined) === 'domestic') {
      domesticSkipped++
      continue
    }

    const bodyText = bodyTextFromSchedule(r.schedule)
    const next = normalizeProductGeoForPrisma({
      title: r.title ?? '',
      originSource: r.originSource ?? '',
      destination: r.destination,
      destinationRaw: r.destinationRaw,
      primaryDestination: r.primaryDestination,
      bodyText,
      browseHintCountry: r.country,
      browseHintCity: r.city,
    })

    const before: Record<string, unknown> = {}
    let diff = false
    for (const k of GEO_FIELDS) {
      const oldV = (r as Record<string, unknown>)[k] ?? null
      const newV = (next as Record<string, unknown>)[k] ?? null
      before[k] = oldV
      if (oldV !== newV) diff = true
    }
    if (diff) {
      const after: Record<string, unknown> = {}
      for (const k of GEO_FIELDS) after[k] = (next as Record<string, unknown>)[k] ?? null
      patches.push({ id: r.id, originSource: r.originSource ?? '', before, after })
    }
  }

  const patchesA = patches.filter((p) =>
    isCategoryA(
      {
        country: p.before.country,
        city: p.before.city,
        countryKey: p.before.countryKey,
      },
      {
        country: p.after.country,
        city: p.after.city,
        locationMatchConfidence: p.after.locationMatchConfidence,
      },
    ),
  )
  const patchesB = patches.filter((p) => !patchesA.some((a) => a.id === p.id))

  const toApply = applyAOnly ? patchesA : patches

  console.log(
    JSON.stringify(
      {
        registeredScanned: rows.length,
        domesticSkipped,
        wouldUpdate: toApply.length,
        wouldUpdateAll: patches.length,
        categoryA: patchesA.length,
        categoryB: patchesB.length,
        applyAOnly,
        apply,
      },
      null,
      2,
    ),
  )

  if (applyAOnly) {
    const bHandoff = patchesB.map((p) => ({
      id: p.id,
      originSource: p.originSource,
      current: { country: p.before.country, city: p.before.city, countryKey: p.before.countryKey, nodeKey: p.before.nodeKey },
      suggestion: {
        country: p.after.country,
        city: p.after.city,
        countryKey: p.after.countryKey,
        nodeKey: p.after.nodeKey,
        groupKey: p.after.groupKey,
        continent: p.after.continent,
        locationMatchConfidence: p.after.locationMatchConfidence,
        locationMatchSource: p.after.locationMatchSource,
      },
      reasons: bCategoryReasons(
        {
          country: p.before.country,
          city: p.before.city,
          countryKey: p.before.countryKey,
        },
        {
          country: p.after.country,
          city: p.after.city,
          locationMatchConfidence: p.after.locationMatchConfidence,
        },
      ),
    }))
    console.log('[B-handoff]', JSON.stringify({ count: bHandoff.length, items: bHandoff }))
  }

  for (const p of toApply.slice(0, 80)) {
    console.log(JSON.stringify({ id: p.id, before: p.before, after: p.after }))
  }
  if (toApply.length > 80) console.log('[truncated stdout]', toApply.length - 80, 'more rows')

  const doApply = apply && toApply.length > 0
  if (doApply) {
    for (const p of toApply) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          country: p.after.country as string | null,
          city: p.after.city as string | null,
          countryKey: p.after.countryKey as string | null,
          nodeKey: p.after.nodeKey as string | null,
          groupKey: p.after.groupKey as string | null,
          continent: p.after.continent as string | null,
          locationMatchConfidence: p.after.locationMatchConfidence as string | null,
          locationMatchSource: p.after.locationMatchSource as string | null,
        },
      })
    }
    console.log('[apply]', applyAOnly ? 'apply-a-only' : 'full', 'updated', toApply.length, 'rows')
  } else if (!apply && toApply.length > 0) {
    console.log(
      applyAOnly
        ? '[dry-run] A만 반영: `npx tsx scripts/backfill-product-geo-d3.ts --apply-a-only --apply`'
        : '[dry-run] 승인 후 `npx tsx scripts/backfill-product-geo-d3.ts --apply` 로 반영',
    )
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
