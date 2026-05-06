import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { findGroupKeyForCountryKey } from '@/lib/overseas-location-tree'
import { geoKeysMatch, resolveGeoFromTreeSelection, type ResolvedGeoPatch, type TreeSelectionInput } from '../lib/shared'

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

function normalizeNodeKeyInput(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t || null
}

/** G-4: 보조 태그 행 검증·정규화 (트리에 없는 조합 제외) */
function parseSecondaryEntries(raw: unknown): Array<{ groupKey: string; countryKey: string; nodeKey: string | null }> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ groupKey: string; countryKey: string; nodeKey: string | null }> = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const countryKey = typeof o.countryKey === 'string' ? o.countryKey.trim() : ''
    if (!countryKey) continue
    const gkRaw = typeof o.groupKey === 'string' ? o.groupKey.trim() : ''
    const groupKey = gkRaw || findGroupKeyForCountryKey(countryKey)
    if (!groupKey) continue
    const nodeKey = normalizeNodeKeyInput(o.nodeKey)
    const patch = resolveGeoFromTreeSelection({ groupKey, countryKey, nodeKey })
    if (!patch) continue
    const key = `${patch.groupKey}|${patch.countryKey}|${patch.nodeKey ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      groupKey: patch.groupKey,
      countryKey: patch.countryKey,
      nodeKey: patch.nodeKey,
    })
  }
  return out
}

function geoTuple(p: { groupKey: string; countryKey: string; nodeKey: string | null }) {
  return `${p.groupKey}|${p.countryKey}|${p.nodeKey ?? ''}`
}

type Body = {
  id?: string
  /** G-4 */
  primary?: { groupKey?: string; countryKey?: string; nodeKey?: string | null }
  secondary?: unknown[]
  /** 레거시: primary와 동일 의미 */
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
  if (!id) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  let primaryInput: TreeSelectionInput
  if (body.primary && typeof body.primary === 'object') {
    const pr = body.primary
    const groupKey = typeof pr.groupKey === 'string' ? pr.groupKey.trim() : ''
    const countryKey = typeof pr.countryKey === 'string' ? pr.countryKey.trim() : ''
    const nodeKey = normalizeNodeKeyInput(pr.nodeKey)
    if (!groupKey || !countryKey) {
      return NextResponse.json({ error: 'missing_primary_fields' }, { status: 400 })
    }
    primaryInput = { groupKey, countryKey, nodeKey }
  } else {
    const groupKey = typeof body.groupKey === 'string' ? body.groupKey.trim() : ''
    const countryKey = typeof body.countryKey === 'string' ? body.countryKey.trim() : ''
    const nodeKey =
      body.nodeKey === null || body.nodeKey === undefined
        ? null
        : typeof body.nodeKey === 'string'
          ? body.nodeKey.trim() || null
          : null
    if (!groupKey || !countryKey) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }
    primaryInput = { groupKey, countryKey, nodeKey }
  }

  const secondariesRaw = parseSecondaryEntries(body.secondary)
  const patch = resolveGeoFromTreeSelection(primaryInput)
  if (!patch) {
    return NextResponse.json({ error: 'invalid_tree_selection' }, { status: 400 })
  }

  const primaryTuple = geoTuple({
    groupKey: patch.groupKey,
    countryKey: patch.countryKey,
    nodeKey: patch.nodeKey,
  })
  const secondaries = secondariesRaw.filter((s) => geoTuple(s) !== primaryTuple)

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

  const after: ResolvedGeoPatch = {
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
  const primaryTagInserted = secondaries.length > 0
  const tagRows: Array<{
    productId: string
    countryKey: string
    nodeKey: string | null
    groupKey: string | null
    isPrimary: boolean
    sortOrder: number
  }> = []
  if (primaryTagInserted) {
    tagRows.push({
      productId: id,
      countryKey: after.countryKey,
      nodeKey: after.nodeKey,
      groupKey: after.groupKey,
      isPrimary: true,
      sortOrder: 0,
    })
    secondaries.forEach((s, i) => {
      tagRows.push({
        productId: id,
        countryKey: s.countryKey,
        nodeKey: s.nodeKey,
        groupKey: s.groupKey,
        isPrimary: false,
        sortOrder: i + 1,
      })
    })
  }

  const auditPayload = {
    action: 'apply' as const,
    at: now.toISOString(),
    by: auditor,
    before,
    after,
    secondaryTags: secondaries,
    primaryTagInserted,
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCountryTag.deleteMany({ where: { productId: id } })
    await tx.product.update({
      where: { id },
      data: {
        ...after,
        lastGeoAuditAt: now,
        lastGeoAuditedBy: auditor,
        geoAuditSkippedAt: null,
        geoAuditLastPatchJson: JSON.stringify(auditPayload),
      },
    })
    if (tagRows.length > 0) {
      await tx.productCountryTag.createMany({ data: tagRows })
    }
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
    secondaryTagsApplied: secondaries.length,
    primaryCountryTagInserted: primaryTagInserted,
    normalizeWouldMatchApplied,
    normalizeRerunPreview: {
      countryKey: normalizedIfRerun.countryKey,
      nodeKey: normalizedIfRerun.nodeKey,
      groupKey: normalizedIfRerun.groupKey,
      continent: normalizedIfRerun.continent,
    },
  })
}
