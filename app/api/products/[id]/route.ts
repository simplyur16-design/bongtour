import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeRangeOnDemandDepartures } from '@/lib/admin-execute-departures-rescrape'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { parseCounselingNotes } from '@/lib/parsed-product-types'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import * as priceRowsHanatour from '@/lib/product-departure-to-price-rows-hanatour'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/products/[id] — 고객용 단일 상품 (가격·할증·일정 포함, 공개)
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const product = await prisma.product.findFirst({
      where: { id, registrationStatus: 'registered' },
      include: {
        prices: { orderBy: { date: 'asc' } },
        departures: { orderBy: { departureDate: 'asc' } },
        itineraries: { orderBy: { day: 'asc' } },
        optionalTours: true,
        brand: { select: { brandKey: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const bk = String(product.brand?.brandKey ?? '').trim()
    const norm = normalizeSupplierOrigin(product.originSource ?? '')
    const isHanatourPublic = bk === 'hanatour' || norm === 'hanatour'

    const pricesFromLegacy = product.prices
      .filter((p) => isOnOrAfterPublicBookableMinDate(p.date))
      .map((p) => {
        const raw = p.date
        const dateStr =
          raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10)
        return {
          date: dateStr,
          adult: p.adult,
          childBed: p.childBed,
          childNoBed: p.childNoBed,
          infant: p.infant,
          localPrice: p.localPrice ?? null,
          priceGap: p.priceGap,
        }
      })

    let pricesPayload = pricesFromLegacy
    if (isHanatourPublic) {
      const dep = (product.departures ?? []).filter((d) =>
        isOnOrAfterPublicBookableMinDate(d.departureDate)
      )
      if (dep.length > 0) {
        const rows = priceRowsHanatour.productDeparturesToProductPriceRows(dep)
        pricesPayload = rows.map((r) => ({
          date: r.date,
          adult: r.adult ?? r.priceAdult ?? 0,
          childBed: r.childBed ?? 0,
          childNoBed: r.childNoBed ?? 0,
          infant: r.infant ?? 0,
          localPrice: r.localPrice ?? null,
          priceGap: r.priceGap ?? 0,
        }))
      }
    }

    const payload = {
      id: product.id,
      title: product.title,
      destination: product.destination,
      duration: product.duration,
      airline: product.airline,
      mandatoryLocalFee: product.mandatoryLocalFee,
      mandatoryCurrency: product.mandatoryCurrency,
      includedText: product.includedText,
      excludedText: product.excludedText,
      criticalExclusions: product.criticalExclusions ?? null,
      productType: product.productType ?? null,
      airportTransferType: product.airportTransferType ?? null,
      optionalToursStructured: product.optionalToursStructured ?? null,
      counselingNotes: parseCounselingNotes(product.counselingNotes),
      bgImageUrl: product.bgImageUrl ?? null,
      schedule: getScheduleFromProduct(product),
      prices: pricesPayload,
      optionalTours: product.optionalTours.map((o) => ({
        id: o.id,
        name: o.name,
        priceUsd: o.priceUsd,
        duration: o.duration ?? '',
        waitPlaceIfNotJoined: o.waitPlaceIfNotJoined ?? '',
      })),
      shoppingCount: product.shoppingCount ?? null,
      shoppingItems: product.shoppingItems ?? null,
    }
    assertNoInternalMetaLeak(payload, '/api/products/[id]')
    return NextResponse.json(payload)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id] — 고객용 출발일 범위 on-demand(JSON body만 처리, 그 외 404).
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const o = raw as { mode?: string; departureDate?: string; windowDays?: number }
    const modesOk = o?.mode === 'range-on-demand' || o?.mode === 'single-date-on-demand'
    if (!modesOk || typeof o.departureDate !== 'string' || !o.departureDate.trim()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    /** 실브라우저·UI 검증 전용. 설정 시에만 지연(운영 미설정 권장). */
    if (o.mode === 'range-on-demand') {
      const ms = Number(process.env.BONGTOUR_E2E_SLOW_RANGE_ON_DEMAND_MS)
      if (Number.isFinite(ms) && ms > 0 && ms <= 30_000) {
        await new Promise((r) => setTimeout(r, ms))
      }
    }
    const product = await prisma.product.findFirst({
      where: { id, registrationStatus: 'registered' },
      select: {
        id: true,
        originSource: true,
        originCode: true,
        originUrl: true,
        brand: { select: { brandKey: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const w =
      o.mode === 'single-date-on-demand'
        ? 0
        : typeof o.windowDays === 'number'
          ? o.windowDays
          : 14
    const { status, body } = await executeRangeOnDemandDepartures(prisma, product, o.departureDate.trim(), w)
    assertNoInternalMetaLeak(body, '/api/products/[id]')
    return NextResponse.json(body, { status })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
