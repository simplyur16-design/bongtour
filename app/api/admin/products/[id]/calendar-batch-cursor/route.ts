import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { withAdminBatchDbSlot } from '@/lib/admin-batch-db-semaphore'
import { withPrismaRetry } from '@/lib/prisma-retry'
import {
  mergeCalendarBatchCursorIntoRawMeta,
  mergeCalendarBatchHorizonRollingIntoRawMeta,
  mergeCalendarBatchRetiredIntoRawMeta,
} from '@/lib/calendar-batch-cursor'
import { rollingCursorYmdForHorizonReset } from '@/lib/calendar-batch-product-window'
import { seoulCalendarYmd } from '@/lib/scraper-schedule-strategy'

type PatchBody = {
  cursorYmd?: string
  advanceToYmd?: string
  retired?: boolean
  horizonRolling?: boolean
}

function ymdOk(s: string | undefined): string | null {
  const t = (s ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

/**
 * PATCH /api/admin/products/[id]/calendar-batch-cursor
 * Python 배치: 상품별 cursor 전진·지평선 롤링·은퇴.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id: productId } = await params
    const body = (await request.json()) as PatchBody
    return await withAdminBatchDbSlot(`calendar-batch-cursor:${productId}`, () =>
      withPrismaRetry(`calendar-batch-cursor:${productId}`, async () => {
        const row = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, rawMeta: true },
        })
        if (!row) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

        let rawMeta = row.rawMeta

        if (body.horizonRolling === true) {
          const rollingYmd = rollingCursorYmdForHorizonReset(seoulCalendarYmd())
          rawMeta = mergeCalendarBatchHorizonRollingIntoRawMeta(rawMeta, rollingYmd)
          await prisma.product.update({ where: { id: productId }, data: { rawMeta } })
          return NextResponse.json({
            ok: true,
            productId,
            cursorYmd: rollingYmd,
            horizonRolling: true,
            retired: false,
          })
        }

        if (body.retired === true) {
          rawMeta = mergeCalendarBatchRetiredIntoRawMeta(rawMeta, true)
          await prisma.product.update({ where: { id: productId }, data: { rawMeta } })
          return NextResponse.json({ ok: true, productId, retired: true })
        }

        const advance = ymdOk(body.advanceToYmd) ?? ymdOk(body.cursorYmd)
        if (!advance) {
          return NextResponse.json(
            { error: 'cursorYmd or advanceToYmd (YYYY-MM-DD) required' },
            { status: 400 }
          )
        }
        rawMeta = mergeCalendarBatchCursorIntoRawMeta(rawMeta, advance)
        await prisma.product.update({ where: { id: productId }, data: { rawMeta } })
        return NextResponse.json({ ok: true, productId, cursorYmd: advance, retired: false })
      })
    )
  } catch (e) {
    console.error('[calendar-batch-cursor]', e)
    return NextResponse.json({ error: '처리 중 오류' }, { status: 500 })
  }
}
