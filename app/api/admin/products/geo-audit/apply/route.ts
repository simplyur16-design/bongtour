import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { findGroupKeyForCountryKey } from '@/lib/overseas-location-tree'
import { deriveTreeGeoFromMasterPrimary } from '@/lib/geo-audit-tree-from-master'
import { validateOverseasGeoFromMaster } from '@/lib/validate-overseas-geo-master'
import {
  geoKeysMatch,
  resolveGeoFromTreeSelection,
  type ResolvedGeoPatch,
  type TreeSelectionInput,
} from '../lib/shared'

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

/** G-4 레거시: 트리 SSOT 보조 태그 */
function parseSecondaryEntries(
  raw: unknown,
):
  | { ok: true; rows: Array<{ groupKey: string; countryKey: string; nodeKey: string | null }> }
  | { ok: false; reason: string } {
  if (!Array.isArray(raw)) return { ok: true, rows: [] }
  const out: Array<{ groupKey: string; countryKey: string; nodeKey: string | null }> = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const countryKey = typeof o.countryKey === 'string' ? o.countryKey.trim() : ''
    if (!countryKey) continue
    const gkRaw = typeof o.groupKey === 'string' ? o.groupKey.trim() : ''
    const groupKey = gkRaw || findGroupKeyForCountryKey(countryKey) || ''
    if (!groupKey) return { ok: false, reason: 'secondary:missing_group' }
    const nodeKey = normalizeNodeKeyInput(o.nodeKey)
    const resolved = resolveGeoFromTreeSelection({ groupKey, countryKey, nodeKey })
    if (!resolved) return { ok: false, reason: 'secondary:tree_mismatch' }
    const key = `${resolved.groupKey}|${resolved.countryKey}|${resolved.nodeKey ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      groupKey: resolved.groupKey,
      countryKey: resolved.countryKey,
      nodeKey: resolved.nodeKey,
    })
  }
  return { ok: true, rows: out }
}

function geoTuple(p: { groupKey: string; countryKey: string; nodeKey: string | null }) {
  return `${p.groupKey}|${p.countryKey}|${p.nodeKey ?? ''}`
}

type LegacyBody = {
  id?: string
  primary?: { groupKey?: string; countryKey?: string; nodeKey?: string | null }
  secondary?: unknown[]
  groupKey?: string
  countryKey?: string
  nodeKey?: string | null
}

type MasterBody = {
  id?: string
  primary?: { continentKey?: string; countryKey?: string; cityKey?: string | null }
  secondaryCountries?: unknown[]
  secondaryCities?: unknown[]
}

function isMasterPrimary(p: unknown): p is { continentKey: string; countryKey: string; cityKey: string | null } {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  return typeof o.continentKey === 'string' && typeof o.countryKey === 'string'
}

function parseSecondaryCountries(
  raw: unknown,
): { ok: true; rows: Array<{ countryKey: string; sortOrder: number }> } | { ok: false; reason: string } {
  if (!Array.isArray(raw)) return { ok: true, rows: [] }
  const out: Array<{ countryKey: string; sortOrder: number }> = []
  const seen = new Set<string>()
  let i = 0
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const countryKey = typeof o.countryKey === 'string' ? o.countryKey.trim() : ''
    if (!countryKey) continue
    if (seen.has(countryKey)) continue
    seen.add(countryKey)
    const sortOrder =
      typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? Math.floor(o.sortOrder) : i + 1
    out.push({ countryKey, sortOrder })
    i++
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder)
  return { ok: true, rows: out }
}

function parseSecondaryCities(
  raw: unknown,
): { ok: true; rows: Array<{ cityKey: string; sortOrder: number }> } | { ok: false; reason: string } {
  if (!Array.isArray(raw)) return { ok: true, rows: [] }
  const out: Array<{ cityKey: string; sortOrder: number }> = []
  const seen = new Set<string>()
  let i = 0
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const cityKey = typeof o.cityKey === 'string' ? o.cityKey.trim() : ''
    if (!cityKey) continue
    if (seen.has(cityKey)) continue
    seen.add(cityKey)
    const sortOrder =
      typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? Math.floor(o.sortOrder) : i + 1
    out.push({ cityKey, sortOrder })
    i++
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder)
  return { ok: true, rows: out }
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: LegacyBody & MasterBody
  try {
    body = (await req.json()) as LegacyBody & MasterBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  const auditor =
    (admin.user as { email?: string | null; id?: string | null }).email ??
    (admin.user as { id?: string | null }).id ??
    'admin'

  if (body.primary && isMasterPrimary(body.primary)) {
    return applyMasterGeo(id, body as MasterBody, auditor)
  }

  return applyLegacyTree(id, body as LegacyBody, auditor)
}

async function applyMasterGeo(id: string, body: MasterBody, auditor: string) {
  const pr = body.primary!
  const continentKey = pr.continentKey!.trim()
  const countryKey = pr.countryKey!.trim()
  const cityKey =
    pr.cityKey === null || pr.cityKey === undefined || pr.cityKey === ''
      ? null
      : String(pr.cityKey).trim() || null

  const secC = parseSecondaryCountries(body.secondaryCountries)
  if (!secC.ok) return NextResponse.json({ error: 'validation_failed', reason: secC.reason }, { status: 400 })
  const secCity = parseSecondaryCities(body.secondaryCities)
  if (!secCity.ok) return NextResponse.json({ error: 'validation_failed', reason: secCity.reason }, { status: 400 })

  const secondaries = secC.rows.filter((r) => r.countryKey !== countryKey)
  const secondaryCitiesDeduped = secCity.rows.filter((r) => r.cityKey !== (cityKey ?? ''))

  if (secondaryCitiesDeduped.length > 0 && !cityKey) {
    return NextResponse.json(
      { error: 'validation_failed', reason: 'primary_city_required_when_secondary_cities' },
      { status: 400 },
    )
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
      continentKey: true,
      cityKey: true,
      locationMatchConfidence: true,
      locationMatchSource: true,
      travelScope: true,
    },
  })

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (existing.registrationStatus !== 'registered' && existing.registrationStatus !== 'pending') {
    return NextResponse.json({ error: 'not_registered' }, { status: 400 })
  }

  const before = {
    country: existing.country,
    city: existing.city,
    countryKey: existing.countryKey,
    nodeKey: existing.nodeKey,
    groupKey: existing.groupKey,
    continent: existing.continent,
    continentKey: existing.continentKey,
    cityKey: existing.cityKey,
    locationMatchConfidence: existing.locationMatchConfidence,
    locationMatchSource: existing.locationMatchSource,
  }

  const v = await validateOverseasGeoFromMaster(prisma, { continentKey, countryKey, cityKey })
  if (!v.ok) return NextResponse.json({ error: 'validation_failed', reason: v.reason }, { status: 400 })

  for (const s of secondaries) {
    const c = await prisma.country.findUnique({
      where: { countryKey: s.countryKey },
      select: { countryKey: true, isActive: true },
    })
    if (!c?.isActive) {
      return NextResponse.json(
        { error: 'validation_failed', reason: `secondary_country_invalid:${s.countryKey}` },
        { status: 400 },
      )
    }
  }

  for (const s of secondaryCitiesDeduped) {
    const c = await prisma.city.findUnique({
      where: { cityKey: s.cityKey },
      select: { cityKey: true, isActive: true },
    })
    if (!c?.isActive) {
      return NextResponse.json(
        { error: 'validation_failed', reason: `secondary_city_invalid:${s.cityKey}` },
        { status: 400 },
      )
    }
  }

  const pgk = findGroupKeyForCountryKey(countryKey)
  if (!pgk) {
    return NextResponse.json({ error: 'validation_failed', reason: 'primary_group_unresolved' }, { status: 400 })
  }
  for (const s of secondaries) {
    if (!findGroupKeyForCountryKey(s.countryKey)) {
      return NextResponse.json(
        { error: 'validation_failed', reason: `secondary_group_unresolved:${s.countryKey}` },
        { status: 400 },
      )
    }
  }

  const tree = deriveTreeGeoFromMasterPrimary(countryKey, cityKey)
  const groupKey = tree.groupKey ?? existing.groupKey
  const nodeKey = tree.nodeKey
  const continent = tree.continent ?? existing.continent

  const after = {
    continentKey,
    countryKey,
    cityKey,
    country: v.validated.country.koreanLabel,
    city: v.validated.city?.koreanLabel ?? null,
    groupKey,
    nodeKey,
    continent,
    locationMatchConfidence: 'high',
    locationMatchSource: 'geo-audit:manual',
  }

  const primaryCountryTagInserted = secondaries.length > 0
  const countryTagRows: Array<{
    productId: string
    countryKey: string
    nodeKey: string | null
    groupKey: string | null
    isPrimary: boolean
    sortOrder: number
  }> = []

  if (primaryCountryTagInserted) {
    countryTagRows.push({
      productId: id,
      countryKey,
      nodeKey,
      groupKey: pgk,
      isPrimary: true,
      sortOrder: 0,
    })
    for (let i = 0; i < secondaries.length; i++) {
      const s = secondaries[i]!
      const gk = findGroupKeyForCountryKey(s.countryKey)!
      countryTagRows.push({
        productId: id,
        countryKey: s.countryKey,
        nodeKey: null,
        groupKey: gk,
        isPrimary: false,
        sortOrder: i + 1,
      })
    }
  }

  const cityTagRows: Array<{
    productId: string
    cityKey: string
    isPrimary: boolean
    sortOrder: number
  }> = []
  if (secondaryCitiesDeduped.length > 0 && cityKey) {
    cityTagRows.push({
      productId: id,
      cityKey,
      isPrimary: true,
      sortOrder: 0,
    })
    for (let i = 0; i < secondaryCitiesDeduped.length; i++) {
      const s = secondaryCitiesDeduped[i]!
      cityTagRows.push({
        productId: id,
        cityKey: s.cityKey,
        isPrimary: false,
        sortOrder: i + 1,
      })
    }
  }

  const now = new Date()
  const auditBase = { action: 'apply' as const, at: now.toISOString(), by: auditor, before }

  await prisma.$transaction(async (tx) => {
    await tx.productCountryTag.deleteMany({ where: { productId: id } })
    await tx.productCityTag.deleteMany({ where: { productId: id } })

    await tx.product.update({
      where: { id },
      data: {
        ...after,
        lastGeoAuditAt: now,
        lastGeoAuditedBy: auditor,
        geoAuditSkippedAt: null,
        geoAuditLastPatchJson: JSON.stringify({
          ...auditBase,
          after,
          mode: 'master',
          secondaryCountries: secondaries,
          secondaryCities: secondaryCitiesDeduped,
          primaryCountryTagInserted,
          cityTagsInserted: cityTagRows.length,
        }),
      },
    })

    if (countryTagRows.length > 0) {
      await tx.productCountryTag.createMany({ data: countryTagRows })
    }
    if (cityTagRows.length > 0) {
      await tx.productCityTag.createMany({ data: cityTagRows })
    }
  })

  const bodyText = bodyTextFromSchedule(existing.schedule)
  const { geo: normalizedIfRerun } = await normalizeProductGeoForPrisma(prisma, {
    title: existing.title ?? '',
    originSource: existing.originSource ?? '',
    destination: existing.destination,
    destinationRaw: existing.destinationRaw,
    primaryDestination: existing.primaryDestination,
    bodyText,
    browseHintCountry: after.country,
    browseHintCity: after.city,
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
    secondaryCountriesApplied: secondaries.length,
    secondaryCitiesApplied: secondaryCitiesDeduped.length,
    primaryTagInserted: primaryCountryTagInserted,
    primaryCountryTagInserted: primaryCountryTagInserted,
    cityTagsInserted: cityTagRows.length,
    normalizeWouldMatchApplied,
    normalizeRerunPreview: {
      countryKey: normalizedIfRerun.countryKey,
      nodeKey: normalizedIfRerun.nodeKey,
      groupKey: normalizedIfRerun.groupKey,
      continent: normalizedIfRerun.continent,
    },
  })
}

async function applyLegacyTree(id: string, body: LegacyBody, auditor: string) {
  let primaryInput: TreeSelectionInput
  if (body.primary && typeof body.primary === 'object' && !isMasterPrimary(body.primary)) {
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

  const secParsed = parseSecondaryEntries(body.secondary)
  if (!secParsed.ok) {
    return NextResponse.json(
      { error: 'tree_validation_failed', reason: secParsed.reason },
      { status: 400 },
    )
  }
  const secondariesRaw = secParsed.rows

  const priResolved = resolveGeoFromTreeSelection(primaryInput)
  if (!priResolved) {
    return NextResponse.json(
      { error: 'tree_validation_failed', reason: 'primary:tree_mismatch' },
      { status: 400 },
    )
  }
  const patch: ResolvedGeoPatch = {
    continent: priResolved.continent,
    groupKey: priResolved.groupKey,
    countryKey: priResolved.countryKey,
    nodeKey: priResolved.nodeKey,
    country: priResolved.country,
    city: priResolved.city,
    locationMatchConfidence: priResolved.locationMatchConfidence,
    locationMatchSource: priResolved.locationMatchSource,
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
      continentKey: true,
      cityKey: true,
      locationMatchConfidence: true,
      locationMatchSource: true,
      travelScope: true,
    },
  })

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (existing.registrationStatus !== 'registered' && existing.registrationStatus !== 'pending') {
    return NextResponse.json({ error: 'not_registered' }, { status: 400 })
  }

  const before = {
    country: existing.country,
    city: existing.city,
    countryKey: existing.countryKey,
    nodeKey: existing.nodeKey,
    groupKey: existing.groupKey,
    continent: existing.continent,
    continentKey: existing.continentKey,
    cityKey: existing.cityKey,
    locationMatchConfidence: existing.locationMatchConfidence,
    locationMatchSource: existing.locationMatchSource,
  }

  const after: ResolvedGeoPatch & { continentKey?: string | null; cityKey?: string | null } = {
    country: patch.country,
    city: patch.city,
    countryKey: patch.countryKey,
    nodeKey: patch.nodeKey,
    groupKey: patch.groupKey,
    continent: patch.continent,
    locationMatchConfidence: patch.locationMatchConfidence,
    locationMatchSource: patch.locationMatchSource,
  }

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
    mode: 'legacy_tree' as const,
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCountryTag.deleteMany({ where: { productId: id } })
    await tx.productCityTag.deleteMany({ where: { productId: id } })
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
  const { geo: normalizedIfRerun } = await normalizeProductGeoForPrisma(prisma, {
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
    secondaryCountriesApplied: secondaries.length,
    secondaryCitiesApplied: 0,
    primaryTagInserted,
    primaryCountryTagInserted: primaryTagInserted,
    cityTagsInserted: 0,
    normalizeWouldMatchApplied,
    normalizeRerunPreview: {
      countryKey: normalizedIfRerun.countryKey,
      nodeKey: normalizedIfRerun.nodeKey,
      groupKey: normalizedIfRerun.groupKey,
      continent: normalizedIfRerun.continent,
    },
  })
}
