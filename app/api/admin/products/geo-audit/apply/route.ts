import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { geoKeysMatch, resolveGeoFromTreeSelection } from '../lib/shared'

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

type Body = {
  id?: string
  groupKey?: string
  countryKey?: string
  nodeKey?: string | null
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const groupKey = typeof body.groupKey === 'string' ? body.groupKey.trim() : ''
  const countryKey = typeof body.countryKey === 'string' ? body.countryKey.trim() : ''
  const nodeKey =
    body.nodeKey === null || body.nodeKey === undefined
      ? null
      : typeof body.nodeKey === 'string'
        ? body.nodeKey.trim() || null
        : null

  if (!id || !groupKey || !countryKey) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const patch = resolveGeoFromTreeSelection({ groupKey, countryKey, nodeKey })
  if (!patch) {
    return NextResponse.json({ error: 'invalid_tree_selection' }, { status: 400 })
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      registrationStatus: true,
      title: true,
      originSource: true,
      destination: true,
      destinationRaw: true,
      primaryDestination: true,
      schedule: true,
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

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (existing.registrationStatus !== 'registered') {
    return NextResponse.json({ error: 'not_registered' }, { status: 400 })
  }

  const before = {
    country: existing.country,
    city: existing.city,
    countryKey: existing.countryKey,
    nodeKey: existing.nodeKey,
    groupKey: existing.groupKey,
    continent: existing.continent,
    locationMatchConfidence: existing.locationMatchConfidence,
    locationMatchSource: existing.locationMatchSource,
  }

  const after = {
    country: patch.country,
    city: patch.city,
    countryKey: patch.countryKey,
    nodeKey: patch.nodeKey,
    groupKey: patch.groupKey,
    continent: patch.continent,
    locationMatchConfidence: patch.locationMatchConfidence,
    locationMatchSource: patch.locationMatchSource,
  }

  const auditor =
    (admin.user as { email?: string | null; id?: string | null }).email ??
    (admin.user as { id?: string | null }).id ??
    'admin'

  const now = new Date()
  const auditPayload = {
    action: 'apply' as const,
    at: now.toISOString(),
    by: auditor,
    before,
    after,
  }

  await prisma.product.update({
    where: { id },
    data: {
      ...after,
      lastGeoAuditAt: now,
      lastGeoAuditedBy: auditor,
      geoAuditSkippedAt: null,
      geoAuditLastPatchJson: JSON.stringify(auditPayload),
    },
  })

  const bodyText = bodyTextFromSchedule(existing.schedule)
  const normalizedIfRerun = normalizeProductGeoForPrisma({
    title: existing.title ?? '',
    originSource: existing.originSource ?? '',
    destination: existing.destination,
    destinationRaw: existing.destinationRaw,
    primaryDestination: existing.primaryDestination,
    bodyText,
    browseHintCountry: patch.country,
    browseHintCity: patch.city,
  })

  const normalizeWouldMatchApplied = geoKeysMatch(
    {
      countryKey: after.countryKey,
      nodeKey: after.nodeKey,
      groupKey: after.groupKey,
      continent: after.continent,
    },
    {
      countryKey: normalizedIfRerun.countryKey,
      nodeKey: normalizedIfRerun.nodeKey,
      groupKey: normalizedIfRerun.groupKey,
      continent: normalizedIfRerun.continent,
    },
  )

  return NextResponse.json({
    ok: true,
    id,
    applied: after,
    normalizeWouldMatchApplied,
    normalizeRerunPreview: {
      countryKey: normalizedIfRerun.countryKey,
      nodeKey: normalizedIfRerun.nodeKey,
      groupKey: normalizedIfRerun.groupKey,
      continent: normalizedIfRerun.continent,
    },
  })
}
