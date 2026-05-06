import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

type Body = { id?: string }

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
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

  const existing = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      registrationStatus: true,
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
  if (existing.registrationStatus !== 'registered' && existing.registrationStatus !== 'pending') {
    return NextResponse.json({ error: 'not_registered' }, { status: 400 })
  }

  const auditor =
    (admin.user as { email?: string | null; id?: string | null }).email ??
    (admin.user as { id?: string | null }).id ??
    'admin'

  const now = new Date()
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

  const auditPayload = {
    action: 'skip' as const,
    at: now.toISOString(),
    by: auditor,
    before,
    after: before,
  }

  await prisma.product.update({
    where: { id },
    data: {
      geoAuditSkippedAt: now,
      geoAuditLastPatchJson: JSON.stringify(auditPayload),
    },
  })

  return NextResponse.json({ ok: true, id, geoAuditSkippedAt: now.toISOString() })
}
