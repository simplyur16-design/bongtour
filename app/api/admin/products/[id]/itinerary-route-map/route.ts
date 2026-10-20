import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { prisma } from '@/lib/prisma'
import { generateAndPersistItineraryRouteMap } from '@/lib/itinerary-route-map-generate'
import { getItineraryRouteMapFromRawMeta } from '@/lib/itinerary-route-map-raw-meta'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET — 저장된 일정 동선 지도 메타.
 * POST — Imagen flat 2D 지도 생성·저장 (body.force=true 시 재생성).
 */
export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: 'productId 필요' }, { status: 400 })
  }
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, rawMeta: true },
  })
  if (!product) {
    return NextResponse.json({ ok: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 })
  }
  const meta = getItineraryRouteMapFromRawMeta(product.rawMeta)
  return NextResponse.json({ ok: true, meta })
}

export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { id } = await ctx.params
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: 'productId 필요' }, { status: 400 })
  }
  const body = (await req.json().catch(() => ({}))) as { force?: boolean }
  const result = await generateAndPersistItineraryRouteMap(prisma, id, {
    force: body.force === true,
  })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, hubsFound: result.hubsFound },
      { status: 400 },
    )
  }
  return NextResponse.json({
    ok: true,
    meta: result.meta,
    skipped: result.skipped === true,
    promptUsed: result.promptUsed || undefined,
  })
}
