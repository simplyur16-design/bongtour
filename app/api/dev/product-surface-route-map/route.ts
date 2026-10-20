/**
 * /dev 동선지도 — 등록 시 저장분 조회 또는 force 재생성(백필).
 * 조회 클릭으로 매번 그리는 경로가 아님. SSOT는 ensureBongtourRouteMapPersisted.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: product-surface-route-map API — manifest
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureBongtourRouteMapPersisted,
  readBongtourRouteMapPersisted,
} from '@/lib/bongtour-route-map-persist-ssot'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function assertDev(): NextResponse | null {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ ok: false, reason: 'not_dev' }, { status: 404 })
  }
  return null
}

export async function GET(req: Request) {
  const blocked = assertDev()
  if (blocked) return blocked

  const url = new URL(req.url)
  const idOrSlug = (url.searchParams.get('slug') || url.searchParams.get('id') || '').trim()
  const force = url.searchParams.get('force') === '1'
  if (!idOrSlug) {
    return NextResponse.json({ ok: false, reason: 'missing_slug' }, { status: 400 })
  }

  const row = await prisma.product.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, rawMeta: true },
  })
  if (!row) {
    return NextResponse.json({ ok: false, reason: 'product_not_found' }, { status: 404 })
  }

  if (!force) {
    const persisted = readBongtourRouteMapPersisted(row.rawMeta)
    if (persisted?.status === 'ready' && persisted.imageUrl) {
      return NextResponse.json({
        ok: true,
        dataUrl: persisted.imageUrl,
        routeSummary: persisted.routeSummary,
        source: 'persisted',
      })
    }
    return NextResponse.json(
      {
        ok: false,
        reason: persisted?.failReason || 'not_persisted_at_register',
        status: persisted?.status || 'missing',
      },
      { status: 404 }
    )
  }

  const out = await ensureBongtourRouteMapPersisted(row.id, { force: true })
  if (out?.status === 'ready' && out.imageUrl) {
    return NextResponse.json({
      ok: true,
      dataUrl: out.imageUrl,
      routeSummary: out.routeSummary,
      source: 'persisted',
    })
  }
  return NextResponse.json(
    { ok: false, reason: out?.failReason || 'persist_failed', status: out?.status },
    { status: 502 }
  )
}
