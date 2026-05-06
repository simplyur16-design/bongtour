import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { normalizeProductGeoTreePreview } from '@/lib/normalize-product-geo'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { mapTreeKeysToMasterKeys } from '@/lib/product-master-mapping'
import { geoKeysMatch, productRowNeedsGeoAudit } from '../lib/shared'

export const dynamic = 'force-dynamic'

function bodyTextFromSchedule(schedule: string | null): string | null {
  if (!schedule?.trim()) return null
  const rows = getScheduleFromProduct({ schedule })
  const t = rows
    .map((d) => [d.title, d.description].filter(Boolean).join(' '))
    .filter(Boolean)
    .join('\n')
  return t.length ? t : null
}

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10) || 25))
  const includeSkipped = searchParams.get('includeSkipped') === '1'

  const all = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      NOT: { travelScope: 'domestic' },
      ...(includeSkipped ? {} : { geoAuditSkippedAt: null }),
    },
    orderBy: [{ title: 'asc' }],
    select: {
      id: true,
      originSource: true,
      title: true,
      destinationRaw: true,
      primaryDestination: true,
      destination: true,
      originUrl: true,
      schedule: true,
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
      registrationStatus: true,
      travelScope: true,
      lastGeoAuditAt: true,
      lastGeoAuditedBy: true,
      geoAuditSkippedAt: true,
      countryTags: {
        select: {
          countryKey: true,
          nodeKey: true,
          groupKey: true,
          isPrimary: true,
          sortOrder: true,
          country: { select: { koreanLabel: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      cityTags: {
        select: {
          cityKey: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  const auditRows = all.filter(productRowNeedsGeoAudit)
  const total = auditRows.length
  const slice = auditRows.slice((page - 1) * limit, page * limit)

  const allCityKeysInSlice = new Set<string>()
  for (const p of slice) {
    if (p.cityKey) allCityKeysInSlice.add(p.cityKey)
    for (const t of p.cityTags ?? []) allCityKeysInSlice.add(t.cityKey)
  }
  const cityLabelRows =
    allCityKeysInSlice.size > 0
      ? await prisma.city.findMany({
          where: { cityKey: { in: [...allCityKeysInSlice] } },
          select: { cityKey: true, koreanLabel: true },
        })
      : []
  const cityLabelByKey = new Map(cityLabelRows.map((c) => [c.cityKey, c.koreanLabel]))

  const masterHints = slice.map((p) => {
    const bodyText = bodyTextFromSchedule(p.schedule)
    const suggestion = normalizeProductGeoTreePreview({
      title: p.title ?? '',
      originSource: p.originSource ?? '',
      destination: p.destination,
      destinationRaw: p.destinationRaw,
      primaryDestination: p.primaryDestination,
      bodyText,
      browseHintCountry: p.country,
      browseHintCity: p.city,
    })
    return mapTreeKeysToMasterKeys({
      groupKey: suggestion.groupKey,
      countryKey: suggestion.countryKey,
      nodeKey: suggestion.nodeKey,
    })
  })

  const contKeys = [...new Set(masterHints.map((m) => m.continentKey).filter(Boolean))] as string[]
  const countryKeys = [...new Set(masterHints.map((m) => m.masterCountryKey).filter(Boolean))] as string[]
  const cityKeysHint = [...new Set(masterHints.map((m) => m.cityKey).filter(Boolean))] as string[]

  const [contRows, countryRows, cityRows] = await Promise.all([
    contKeys.length
      ? prisma.continent.findMany({ where: { continentKey: { in: contKeys } }, select: { continentKey: true } })
      : Promise.resolve([]),
    countryKeys.length
      ? prisma.country.findMany({ where: { countryKey: { in: countryKeys } }, select: { countryKey: true } })
      : Promise.resolve([]),
    cityKeysHint.length
      ? prisma.city.findMany({ where: { cityKey: { in: cityKeysHint } }, select: { cityKey: true } })
      : Promise.resolve([]),
  ])
  const contOk = new Set(contRows.map((r) => r.continentKey))
  const countryOk = new Set(countryRows.map((r) => r.countryKey))
  const cityOk = new Set(cityRows.map((r) => r.cityKey))

  const items = slice.map((p, i) => {
    const bodyText = bodyTextFromSchedule(p.schedule)
    const suggestion = normalizeProductGeoTreePreview({
      title: p.title ?? '',
      originSource: p.originSource ?? '',
      destination: p.destination,
      destinationRaw: p.destinationRaw,
      primaryDestination: p.primaryDestination,
      bodyText,
      browseHintCountry: p.country,
      browseHintCity: p.city,
    })

    const suggestionMatchesKeys = geoKeysMatch(
      {
        countryKey: p.countryKey,
        nodeKey: p.nodeKey,
        groupKey: p.groupKey,
        continent: p.continent,
      },
      {
        countryKey: suggestion.countryKey,
        nodeKey: suggestion.nodeKey,
        groupKey: suggestion.groupKey,
        continent: suggestion.continent,
      },
    )

    const ms = masterHints[i]!
    const suggestionMaster = {
      continentKey: ms.continentKey,
      countryKey: ms.masterCountryKey,
      cityKey: ms.cityKey,
      reasons: ms.reasons,
    }
    const suggestionMasterValidated = {
      continent: ms.continentKey ? contOk.has(ms.continentKey) : false,
      country: ms.masterCountryKey ? countryOk.has(ms.masterCountryKey) : false,
      city: ms.cityKey ? cityOk.has(ms.cityKey) : true,
    }

    return {
      id: p.id,
      originSource: p.originSource,
      title: p.title,
      destinationRaw: p.destinationRaw,
      primaryDestination: p.primaryDestination,
      destination: p.destination,
      originUrl: p.originUrl,
      current: {
        country: p.country,
        city: p.city,
        countryKey: p.countryKey,
        nodeKey: p.nodeKey,
        groupKey: p.groupKey,
        continent: p.continent,
        continentKey: p.continentKey,
        cityKey: p.cityKey,
        locationMatchConfidence: p.locationMatchConfidence,
        locationMatchSource: p.locationMatchSource,
      },
      suggestion: {
        country: suggestion.country,
        city: suggestion.city,
        countryKey: suggestion.countryKey,
        nodeKey: suggestion.nodeKey,
        groupKey: suggestion.groupKey,
        continent: suggestion.continent,
        locationMatchConfidence: suggestion.locationMatchConfidence,
        locationMatchSource: suggestion.locationMatchSource,
      },
      suggestionMatchesKeys,
      suggestionMaster,
      suggestionMasterValidated,
      lastGeoAuditAt: p.lastGeoAuditAt?.toISOString() ?? null,
      lastGeoAuditedBy: p.lastGeoAuditedBy,
      geoAuditSkippedAt: p.geoAuditSkippedAt?.toISOString() ?? null,
      countryTags: (p.countryTags ?? []).map((t) => ({
        countryKey: t.countryKey,
        nodeKey: t.nodeKey,
        groupKey: t.groupKey,
        isPrimary: t.isPrimary,
        sortOrder: t.sortOrder,
        koreanLabel: t.country?.koreanLabel ?? null,
      })),
      cityTags: (p.cityTags ?? []).map((t) => ({
        cityKey: t.cityKey,
        isPrimary: t.isPrimary,
        sortOrder: t.sortOrder,
        koreanLabel: cityLabelByKey.get(t.cityKey) ?? null,
      })),
    }
  })

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    includeSkipped,
  })
}
