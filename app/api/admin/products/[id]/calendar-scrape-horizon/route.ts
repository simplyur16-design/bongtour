import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  calendarPriceHorizonDateRangeYmd,
  CALENDAR_PRICE_HORIZON_DAYS,
} from '@/lib/calendar-price-horizon'
import { collectCalendarHorizonPriceInputs } from '@/lib/calendar-scrape-horizon-collect'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

// REGRESSION-FREEZE[calendar-batch-api-first]: 3h batch Node API→E2E — manifest

type Body = {
  fromYmd?: string
  toYmd?: string
}

function ymdOk(s: string | undefined): string | null {
  const t = (s ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

const HORIZON_BATCH_SUPPLIERS = new Set([
  'hanatour',
  'ybtour',
  'verygoodtour',
  'lottetour',
  'kyowontour',
])

/**
 * POST /api/admin/products/[id]/calendar-scrape-horizon
 * 3h 순차 배치 SSOT — API/HXR 우선, 0건 시에만 E2E. Python E2E 직접 호출 금지.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id: productId } = await params
    const body = (await request.json().catch(() => ({}))) as Body
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        originSource: true,
        originCode: true,
        originUrl: true,
        title: true,
        originalTitle: true,
        rawMeta: true,
      },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const supplier = normalizeSupplierOrigin(product.originSource)
    if (!supplier || !HORIZON_BATCH_SUPPLIERS.has(supplier)) {
      return NextResponse.json(
        { error: `calendar-scrape-horizon 미지원 공급사: ${supplier ?? 'unknown'}` },
        { status: 400 },
      )
    }

    const defaultRange = calendarPriceHorizonDateRangeYmd()
    const fromYmd = ymdOk(body.fromYmd) ?? defaultRange.fromYmd
    const toYmd = ymdOk(body.toYmd) ?? defaultRange.toYmd
    const lo = fromYmd <= toYmd ? fromYmd : toYmd
    const hi = fromYmd <= toYmd ? toYmd : fromYmd

    const collected = await collectCalendarHorizonPriceInputs(product, lo, hi)

    return NextResponse.json({
      ok: true,
      productId,
      supplier,
      fromYmd: lo,
      toYmd: hi,
      horizonDays: CALENDAR_PRICE_HORIZON_DAYS,
      source: collected.source,
      e2eAttempted: collected.e2eAttempted,
      horizonSoldOut: collected.horizonSoldOut,
      warnings: collected.warnings.slice(0, 20),
      items: collected.items,
    })
  } catch (e) {
    console.error('[calendar-scrape-horizon]', e)
    return NextResponse.json({ error: '처리 중 오류' }, { status: 500 })
  }
}
