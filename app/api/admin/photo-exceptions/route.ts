import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { openPhotoExceptions, parsePhotoExceptionNote, PHOTO_EXCEPTION_SELECTION_MODE } from '@/lib/photo-exception-list'

export const dynamic = 'force-dynamic'

/** 문과장이 보는 사진 예외 목록 한 곳(읽기 전용): 자동 채움·자가 힐·야간 점검이 못 고친 칸만 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })

  const since = new Date(Date.now() - 30 * 24 * 3600_000)
  const exceptionRows = await prisma.assetUsageLog.findMany({
    where: { selectionMode: PHOTO_EXCEPTION_SELECTION_MODE, usedAt: { gte: since } },
    orderBy: { usedAt: 'desc' },
    take: 2000,
    select: { productId: true, day: true, usedAt: true, notes: true },
  })
  const productIds = [...new Set(exceptionRows.map((r) => r.productId))]
  const autoRows = productIds.length
    ? await prisma.assetUsageLog.findMany({
        where: { productId: { in: productIds }, selectionMode: 'auto', usedAt: { gte: since } },
        select: { productId: true, day: true, usedAt: true },
      })
    : []
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true, bgImageUrl: true, registrationStatus: true } })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))

  const seen = new Set<string>()
  const items = openPhotoExceptions(exceptionRows, autoRows).flatMap((r) => {
    const parsed = parsePhotoExceptionNote(r.notes)
    if (!parsed) return []
    const p = byId.get(r.productId)
    if (parsed.kind === 'cover' && p?.bgImageUrl) return []
    const key = `${r.productId}:${parsed.kind}:${parsed.kind === 'cover' ? 0 : r.day}`
    if (seen.has(key)) return []
    seen.add(key)
    return [
      {
        productId: r.productId,
        title: p?.title ?? null,
        registrationStatus: p?.registrationStatus ?? null,
        slot: parsed.kind,
        day: parsed.kind === 'cover' ? null : r.day,
        sight: parsed.sight,
        query: parsed.query,
        reason: parsed.reason,
        detail: parsed.detail,
        origin: parsed.origin,
        at: parsed.at || new Date(r.usedAt).toISOString(),
      },
    ]
  })
  return NextResponse.json({ ok: true, count: items.length, items })
}
