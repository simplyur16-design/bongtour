import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import {
  calendarPriceHorizonDateRangeYmd,
  CALENDAR_PRICE_HORIZON_DAYS,
} from '@/lib/calendar-price-horizon'
import { collectModetourDepartureInputsForDateRange } from '@/lib/modetour-departures'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'

// REGRESSION-FREEZE[calendar-price-horizon-180d]: modetour 배치는 API만 — manifest

type Body = {
  fromYmd?: string
  toYmd?: string
}

function ymdOk(s: string | undefined): string | null {
  const t = (s ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}

function modetourInputToCalendarItem(inp: DepartureInput) {
  const date = departureInputToYmd(inp.departureDate)
  if (!date) return null
  const price = inp.adultPrice != null ? Number(inp.adultPrice) : null
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  return {
    date,
    price,
    adultPrice: price,
    statusRaw: inp.statusRaw ?? inp.seatsStatusRaw ?? null,
    seatsStatusRaw: inp.seatsStatusRaw ?? null,
    minPax: inp.minPax ?? null,
    carrierName: inp.carrierName ?? null,
    outboundFlightNo: inp.outboundFlightNo ?? null,
    outboundDepartureAirport: inp.outboundDepartureAirport ?? null,
    outboundDepartureAt: inp.outboundDepartureAt ?? null,
    outboundArrivalAirport: inp.outboundArrivalAirport ?? null,
    outboundArrivalAt: inp.outboundArrivalAt ?? null,
    inboundFlightNo: inp.inboundFlightNo ?? null,
    inboundDepartureAirport: inp.inboundDepartureAirport ?? null,
    inboundDepartureAt: inp.inboundDepartureAt ?? null,
    inboundArrivalAirport: inp.inboundArrivalAirport ?? null,
    inboundArrivalAt: inp.inboundArrivalAt ?? null,
    meetingInfoRaw: inp.meetingInfoRaw ?? null,
    meetingPointRaw: inp.meetingPointRaw ?? null,
    meetingTerminalRaw: inp.meetingTerminalRaw ?? null,
    meetingGuideNoticeRaw: inp.meetingGuideNoticeRaw ?? null,
  }
}

/**
 * POST /api/admin/products/[id]/calendar-scrape-modetour-api
 * modetour 달력 배치 전용 — B2C API 180일(기본) 1회. Python E2E 배치 금지 SSOT.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id: productId } = await params
    const body = (await request.json().catch(() => ({}))) as Body
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, originSource: true, originCode: true, originUrl: true },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const detailUrl =
      (product.originUrl ?? '').trim().startsWith('http')
        ? product.originUrl!.trim()
        : buildDetailUrl(product.originSource ?? 'modetour', product.originCode ?? '')
    if (!detailUrl.startsWith('http')) {
      return NextResponse.json({ error: '유효한 modetour 상세 URL 없음' }, { status: 400 })
    }

    const defaultRange = calendarPriceHorizonDateRangeYmd()
    const fromYmd = ymdOk(body.fromYmd) ?? defaultRange.fromYmd
    const toYmd = ymdOk(body.toYmd) ?? defaultRange.toYmd
    const lo = fromYmd <= toYmd ? fromYmd : toYmd
    const hi = fromYmd <= toYmd ? toYmd : fromYmd

    const inputs = await collectModetourDepartureInputsForDateRange(detailUrl, lo, hi)
    const items = inputs
      .map(modetourInputToCalendarItem)
      .filter((x): x is NonNullable<typeof x> => x != null)

    return NextResponse.json({
      ok: true,
      productId,
      fromYmd: lo,
      toYmd: hi,
      horizonDays: CALENDAR_PRICE_HORIZON_DAYS,
      source: 'modetour-b2c-api',
      items,
    })
  } catch (e) {
    console.error('[calendar-scrape-modetour-api]', e)
    return NextResponse.json({ error: '처리 중 오류' }, { status: 500 })
  }
}
