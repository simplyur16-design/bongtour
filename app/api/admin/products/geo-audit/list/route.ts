import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
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
      locationMatchConfidence: true,
      locationMatchSource: true,
      registrationStatus: true,
      travelScope: true,
      lastGeoAuditAt: true,
      lastGeoAuditedBy: true,
      geoAuditSkippedAt: true,
    },
  })

  const auditRows = all.filter(productRowNeedsGeoAudit)
  const total = auditRows.length
  const slice = auditRows.slice((page - 1) * limit, page * limit)

  const items = await Promise.all(
    slice.map(async (p) => {
      const bodyText = bodyTextFromSchedule(p.schedule)
      const suggestion = normalizeProductGeoForPrisma({
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
        lastGeoAuditAt: p.lastGeoAuditAt?.toISOString() ?? null,
        lastGeoAuditedBy: p.lastGeoAuditedBy,
        geoAuditSkippedAt: p.geoAuditSkippedAt?.toISOString() ?? null,
      }
    }),
  )

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    includeSkipped,
  })
}
