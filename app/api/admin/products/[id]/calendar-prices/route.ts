import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import * as updDeparturesHanatour from '@/lib/upsert-product-departures-hanatour'
import * as updDeparturesModetour from '@/lib/upsert-product-departures-modetour'
import * as updDeparturesVerygoodtour from '@/lib/upsert-product-departures-verygoodtour'
import * as updDeparturesYbtour from '@/lib/upsert-product-departures-ybtour'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

function upsertDeparturesModuleForProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}) {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource)
  if (fromBrand === 'modetour') return updDeparturesModetour
  if (fromBrand === 'verygoodtour') return updDeparturesVerygoodtour
  if (fromBrand === 'ybtour') return updDeparturesYbtour
  if (fromBrand === 'hanatour') return updDeparturesHanatour
  if (norm === 'modetour') return updDeparturesModetour
  if (norm === 'verygoodtour') return updDeparturesVerygoodtour
  if (norm === 'ybtour') return updDeparturesYbtour
  return updDeparturesHanatour
}

/** 달력 반영 라우트 로컬: 성인만 요청값으로 갱신, 아동·유아는 요청에 숫자가 있을 때만·없으면 기존 출발 행 유지 */
function pickPreservedChildInfantPriceForCalendar(
  incoming: number | null | undefined,
  existing: number | null | undefined
): number | null {
  if (incoming !== undefined && incoming !== null && Number.isFinite(incoming)) {
    return incoming
  }
  if (existing !== undefined && existing !== null && Number.isFinite(existing)) {
    return existing
  }
  return null
}

type BodyItem = {
  date: string
  price: number
  status?: string
  statusRaw?: string
  seatsStatusRaw?: string | null
  adultPrice?: number | null
  childBedPrice?: number | null
  childNoBedPrice?: number | null
  infantPrice?: number | null
  localPriceText?: string | null
  minPax?: number | null
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: string | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
}

/**
 * POST /api/admin/products/[id]/calendar-prices. 인증: 관리자.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id: productId } = await params
    const body = (await request.json()) as { items?: BodyItem[] }
    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ updated: 0, created: 0 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, originSource: true, brand: { select: { brandKey: true } } },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const normalized = items
      .map((i) => {
        const d = i?.date?.trim()
        const p = Number(i?.price ?? i?.adultPrice)
        if (!d || Number.isNaN(p) || p < 0) return null
        const date = new Date(d)
        if (Number.isNaN(date.getTime())) return null
        return {
          date,
          adult: Math.round(p),
          statusRaw: i.statusRaw?.trim() || i.status?.trim() || null,
          seatsStatusRaw: i.seatsStatusRaw?.trim() || null,
          adultPrice: i.adultPrice != null ? Number(i.adultPrice) : Math.round(p),
          childBedPrice: i.childBedPrice != null ? Number(i.childBedPrice) : null,
          childNoBedPrice: i.childNoBedPrice != null ? Number(i.childNoBedPrice) : null,
          infantPrice: i.infantPrice != null ? Number(i.infantPrice) : null,
          localPriceText: i.localPriceText?.trim() || null,
          minPax: i.minPax != null ? Number(i.minPax) : null,
          carrierName: i.carrierName?.trim() || null,
          outboundFlightNo: i.outboundFlightNo?.trim() || null,
          outboundDepartureAirport: i.outboundDepartureAirport?.trim() || null,
          outboundDepartureAt: i.outboundDepartureAt?.trim() || null,
          outboundArrivalAirport: i.outboundArrivalAirport?.trim() || null,
          outboundArrivalAt: i.outboundArrivalAt?.trim() || null,
          inboundFlightNo: i.inboundFlightNo?.trim() || null,
          inboundDepartureAirport: i.inboundDepartureAirport?.trim() || null,
          inboundDepartureAt: i.inboundDepartureAt?.trim() || null,
          inboundArrivalAirport: i.inboundArrivalAirport?.trim() || null,
          inboundArrivalAt: i.inboundArrivalAt?.trim() || null,
          meetingInfoRaw: i.meetingInfoRaw?.trim() || null,
          meetingPointRaw: i.meetingPointRaw?.trim() || null,
          meetingTerminalRaw: i.meetingTerminalRaw?.trim() || null,
          meetingGuideNoticeRaw: i.meetingGuideNoticeRaw?.trim() || null,
        }
      })
      .filter(
        (
          x
        ): x is {
          date: Date
          adult: number
          statusRaw: string | null
          seatsStatusRaw: string | null
          adultPrice: number
          childBedPrice: number | null
          childNoBedPrice: number | null
          infantPrice: number | null
          localPriceText: string | null
          minPax: number | null
          carrierName: string | null
          outboundFlightNo: string | null
          outboundDepartureAirport: string | null
          outboundDepartureAt: string | null
          outboundArrivalAirport: string | null
          outboundArrivalAt: string | null
          inboundFlightNo: string | null
          inboundDepartureAirport: string | null
          inboundDepartureAt: string | null
          inboundArrivalAirport: string | null
          inboundArrivalAt: string | null
          meetingInfoRaw: string | null
          meetingPointRaw: string | null
          meetingTerminalRaw: string | null
          meetingGuideNoticeRaw: string | null
        } => x !== null
      )

    const dates = normalized.map((n) => n.date)
    const existingDepartures = await prisma.productDeparture.findMany({
      where: { productId, departureDate: { in: dates } },
      select: {
        departureDate: true,
        childBedPrice: true,
        childNoBedPrice: true,
        infantPrice: true,
      },
    })
    const existingChildByUtc = new Map<
      number,
      { childBedPrice: number | null; childNoBedPrice: number | null; infantPrice: number | null }
    >()
    for (const row of existingDepartures) {
      existingChildByUtc.set(row.departureDate.getTime(), {
        childBedPrice: row.childBedPrice,
        childNoBedPrice: row.childNoBedPrice,
        infantPrice: row.infantPrice,
      })
    }

    await prisma.productPrice.deleteMany({
      where: { productId, date: { in: dates } },
    })
    const created = await prisma.productPrice.createMany({
      data: normalized.map((n) => {
        const prev = existingChildByUtc.get(n.date.getTime())
        const childBed = pickPreservedChildInfantPriceForCalendar(n.childBedPrice, prev?.childBedPrice) ?? 0
        const childNoBed = pickPreservedChildInfantPriceForCalendar(n.childNoBedPrice, prev?.childNoBedPrice) ?? 0
        const infant = pickPreservedChildInfantPriceForCalendar(n.infantPrice, prev?.infantPrice) ?? 0
        return {
          productId,
          date: n.date,
          adult: n.adult,
          childBed,
          childNoBed,
          infant,
        }
      }),
    })

    await upsertDeparturesModuleForProduct(product).upsertProductDepartures(
      prisma,
      productId,
      normalized.map((n) => {
        const prev = existingChildByUtc.get(n.date.getTime())
        return {
          departureDate: n.date,
          adultPrice: n.adultPrice,
          childBedPrice: pickPreservedChildInfantPriceForCalendar(n.childBedPrice, prev?.childBedPrice),
          childNoBedPrice: pickPreservedChildInfantPriceForCalendar(n.childNoBedPrice, prev?.childNoBedPrice),
          infantPrice: pickPreservedChildInfantPriceForCalendar(n.infantPrice, prev?.infantPrice),
          localPriceText: n.localPriceText,
          statusRaw: n.statusRaw,
          seatsStatusRaw: n.seatsStatusRaw,
          minPax: n.minPax,
          carrierName: n.carrierName,
          outboundFlightNo: n.outboundFlightNo,
          outboundDepartureAirport: n.outboundDepartureAirport,
          outboundDepartureAt: n.outboundDepartureAt,
          outboundArrivalAirport: n.outboundArrivalAirport,
          outboundArrivalAt: n.outboundArrivalAt,
          inboundFlightNo: n.inboundFlightNo,
          inboundDepartureAirport: n.inboundDepartureAirport,
          inboundDepartureAt: n.inboundDepartureAt,
          inboundArrivalAirport: n.inboundArrivalAirport,
          inboundArrivalAt: n.inboundArrivalAt,
          meetingInfoRaw: n.meetingInfoRaw,
          meetingPointRaw: n.meetingPointRaw,
          meetingTerminalRaw: n.meetingTerminalRaw,
          meetingGuideNoticeRaw: n.meetingGuideNoticeRaw,
        }
      })
    )

    await prisma.scraperQueue.deleteMany({ where: { productId } }).catch(() => {})

    return NextResponse.json({ updated: normalized.length, created: created.count })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
