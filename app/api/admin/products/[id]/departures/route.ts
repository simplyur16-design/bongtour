import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  executeAdminDeparturesRescrapeCore,
  executeRangeOnDemandDepartures,
} from '@/lib/admin-execute-departures-rescrape'
import type {
  AdminDeparturesRescrapeResponseBody,
  AdminDeparturesRescrapeStage,
} from '@/lib/admin-departures-rescrape-types'

export type { AdminDeparturesRescrapeResponseBody, AdminDeparturesRescrapeStage }

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/products/[id]/departures — 상품별 ProductDeparture 조회. 인증: 관리자.
 * departureDate ASC 정렬. product 없으면 404. 데이터 없음 → [].
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const departures = await prisma.productDeparture.findMany({
      where: { productId: id },
      orderBy: { departureDate: 'asc' },
      select: {
        id: true,
        productId: true,
        departureDate: true,
        adultPrice: true,
        childBedPrice: true,
        childNoBedPrice: true,
        infantPrice: true,
        localPriceText: true,
        statusRaw: true,
        seatsStatusRaw: true,
        isConfirmed: true,
        isBookable: true,
        minPax: true,
        syncedAt: true,
        carrierName: true,
        outboundFlightNo: true,
        outboundDepartureAirport: true,
        outboundDepartureAt: true,
        outboundArrivalAirport: true,
        outboundArrivalAt: true,
        inboundFlightNo: true,
        inboundDepartureAirport: true,
        inboundDepartureAt: true,
        inboundArrivalAirport: true,
        inboundArrivalAt: true,
        meetingInfoRaw: true,
        meetingPointRaw: true,
        meetingTerminalRaw: true,
        meetingGuideNoticeRaw: true,
      },
    })
    return NextResponse.json(departures)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/products/[id]/departures
 * 공급사별 live-rescrape 후 ProductDeparture upsert.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) {
    const body: AdminDeparturesRescrapeResponseBody = {
      ok: false,
      stage: 'route',
      message: '관리자 인증이 필요합니다.',
      site: null,
      detailUrl: null,
      collectorStatus: null,
      collectedCount: 0,
      upsertAttemptedCount: 0,
      upsertedCount: 0,
      emptyResult: true,
      pythonTimedOut: false,
      stderrSummary: '',
      stdoutSummary: '',
      diagnostics: null,
      error: '인증이 필요합니다.',
    }
    return NextResponse.json(body, { status: 401 })
  }
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          stage: 'route',
          message: 'Invalid id',
          site: null,
          detailUrl: null,
          collectorStatus: null,
          collectedCount: 0,
          upsertAttemptedCount: 0,
          upsertedCount: 0,
          emptyResult: true,
          pythonTimedOut: false,
          stderrSummary: '',
          stdoutSummary: '',
          diagnostics: null,
          error: 'Invalid id',
        } satisfies AdminDeparturesRescrapeResponseBody,
        { status: 400 }
      )
    }

    const rawText = await request.text().catch(() => '')
    let parsedBody: { mode?: string; departureDate?: string; windowDays?: number } | null = null
    if (rawText.trim()) {
      try {
        parsedBody = JSON.parse(rawText) as { mode?: string; departureDate?: string; windowDays?: number }
      } catch {
        parsedBody = null
      }
    }
    const onDemandDate =
      typeof parsedBody?.departureDate === 'string' && parsedBody.departureDate.trim()
        ? parsedBody.departureDate.trim()
        : null
    if (
      (parsedBody?.mode === 'range-on-demand' || parsedBody?.mode === 'single-date-on-demand') &&
      onDemandDate
    ) {
      const productSingle = await prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          originSource: true,
          originCode: true,
          originUrl: true,
          brand: { select: { brandKey: true } },
        },
      })
      if (!productSingle) {
        return NextResponse.json(
          { ok: false, reason: 'departure_not_found', departureDate: onDemandDate },
          { status: 404 }
        )
      }
      const w =
        parsedBody.mode === 'single-date-on-demand'
          ? 0
          : typeof parsedBody.windowDays === 'number'
            ? parsedBody.windowDays
            : 14
      const { status, body } = await executeRangeOnDemandDepartures(prisma, productSingle, onDemandDate, w)
      return NextResponse.json(body, { status })
    }

    const url = new URL(request.url)
    const hanatourMonthParam = url.searchParams.get('hanatourMonth')?.trim() || null

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        originSource: true,
        originCode: true,
        originUrl: true,
        brand: { select: { brandKey: true } },
      },
    })
    if (!product) {
      return NextResponse.json(
        {
          ok: false,
          stage: 'route',
          message: '상품을 찾을 수 없습니다.',
          site: null,
          detailUrl: null,
          collectorStatus: null,
          collectedCount: 0,
          upsertAttemptedCount: 0,
          upsertedCount: 0,
          emptyResult: true,
          pythonTimedOut: false,
          stderrSummary: '',
          stdoutSummary: '',
          diagnostics: null,
          error: 'Not found',
        } satisfies AdminDeparturesRescrapeResponseBody,
        { status: 404 }
      )
    }

    console.log(
      '[departures POST] route-enter',
      JSON.stringify({
        productId: product.id,
        originSource: (product.originSource ?? '').slice(0, 120),
        originCode: (product.originCode ?? '').slice(0, 80),
        brandKey: product.brand?.brandKey ?? null,
        hasOriginUrl: !!product.originUrl?.trim(),
      })
    )

    const { status, body } = await executeAdminDeparturesRescrapeCore(prisma, product, hanatourMonthParam)
    if (!body.ok) {
      console.log('[departures POST] response-empty-or-error', JSON.stringify(body))
    } else {
      console.log('[departures POST] response-ok', JSON.stringify(body))
    }
    return NextResponse.json(body, { status })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : '처리 중 오류'
    const body: AdminDeparturesRescrapeResponseBody = {
      ok: false,
      stage: 'collect',
      message: msg.slice(0, 400),
      site: null,
      detailUrl: null,
      collectorStatus: null,
      collectedCount: 0,
      upsertAttemptedCount: 0,
      upsertedCount: 0,
      emptyResult: true,
      pythonTimedOut: false,
      stderrSummary: '',
      stdoutSummary: '',
      diagnostics: null,
      error: msg.slice(0, 400),
    }
    return NextResponse.json(body, { status: 500 })
  }
}
