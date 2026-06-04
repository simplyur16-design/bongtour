/**
 * modetour 패키지 단건 — B2C API(`collectModetourDepartureInputs`) → ProductPrice·ProductDeparture 동기화.
 * 관리자 출발 재수집·등록 confirm 과 동일 SSOT (`lib/modetour-departures.ts`).
 * 21:00 배치 cron 은 별도로 Python `calendar_e2e_scraper_modetour` 를 쓸 수 있음 — 이 명령은 API 우선.
 */
import fs from 'fs'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import {
  applyProductCalendarPriceItems,
  type CalendarPriceApplyItem,
} from '@/lib/apply-product-calendar-price-items'
import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import { collectModetourDepartureInputs } from '@/lib/modetour-departures'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { revalidateProductDetailCaches } from '@/lib/revalidate-product-detail-caches'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'
import {
  departureInputToYmd,
  filterDepartureInputsOnOrAfterCalendarToday,
  SCRAPE_DEFAULT_MONTHS_FORWARD,
} from '@/lib/scrape-date-bounds'

export type SyncModetourPriceSingleOpts = {
  slug?: string | null
  productId?: string | null
  dryRun?: boolean
  skipPayloadRebuild?: boolean
  backupDir?: string
}

export type SyncModetourPriceSingleResult = {
  ok: boolean
  productId: string
  slug: string | null
  title: string
  detailUrl: string
  backupPath: string | null
  scrapedRowCount: number
  acceptedCount: number
  productPriceCreated: number
  departuresUpserted: number
  payloadRebuilt: boolean
  beforeSample: { prices: number; departures: number; minAdult: number | null }
  afterSample: { prices: number; departures: number; minAdult: number | null }
  liveError?: string | null
  collectSource?: string | null
  collectNotes?: string[]
}

function assertModetourTravelPackage(product: {
  id: string
  originSource: string | null
  listingKind: string | null
  productType: string | null
}): void {
  const supplier = normalizeSupplierOrigin(product.originSource)
  if (supplier !== 'modetour') {
    throw new Error(
      `거부: originSource가 modetour가 아닙니다 (id=${product.id}, originSource=${product.originSource ?? 'null'})`,
    )
  }
  const lk = (product.listingKind ?? '').trim()
  if (lk === 'air_hotel_free') {
    throw new Error(`거부: 자유여행(air_hotel_free) 상품은 이 명령 대상이 아닙니다 (id=${product.id})`)
  }
  if ((product.productType ?? '').trim() === 'airtel') {
    throw new Error(`거부: productType=airtel 은 이 명령 대상이 아닙니다 (id=${product.id})`)
  }
}

export async function resolveModetourProductForSync(
  prisma: PrismaClient,
  opts: SyncModetourPriceSingleOpts,
): Promise<{
  id: string
  slug: string | null
  title: string
  originSource: string | null
  originCode: string | null
  originUrl: string | null
  listingKind: string | null
  productType: string | null
  publicDetailPayloadBuiltAt: Date | null
}> {
  const slug = opts.slug?.trim() || null
  const productId = opts.productId?.trim() || null
  if (!slug && !productId) {
    throw new Error('--slug 또는 --id 중 하나는 필수입니다.')
  }
  if (slug && productId) {
    throw new Error('--slug 와 --id 는 동시에 지정하지 마세요.')
  }

  const row = await prisma.product.findFirst({
    where: slug ? { slug } : { id: productId! },
    select: {
      id: true,
      slug: true,
      title: true,
      originSource: true,
      originCode: true,
      originUrl: true,
      listingKind: true,
      productType: true,
      publicDetailPayloadBuiltAt: true,
    },
  })
  if (!row) {
    throw new Error(slug ? `slug=${slug} 상품 없음` : `productId=${productId} 상품 없음`)
  }
  assertModetourTravelPackage(row)
  return row
}

function serializePriceRows(
  rows: Array<{
    id: string
    date: Date
    adult: number
    childBed: number
    childNoBed: number
    infant: number
    localPrice: string | null
  }>,
) {
  return rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    adult: r.adult,
    childBed: r.childBed,
    childNoBed: r.childNoBed,
    infant: r.infant,
    localPrice: r.localPrice,
  }))
}

function serializeDepartureRows(
  rows: Array<{
    id: string
    departureDate: Date
    adultPrice: number | null
    childBedPrice: number | null
    childNoBedPrice: number | null
    infantPrice: number | null
    localPriceText: string | null
    statusRaw: string | null
    seatsStatusRaw: string | null
    baselineAdultPrice: number | null
    syncedAt: Date | null
  }>,
) {
  return rows.map((r) => ({
    id: r.id,
    departureDate: r.departureDate.toISOString(),
    adultPrice: r.adultPrice,
    childBedPrice: r.childBedPrice,
    childNoBedPrice: r.childNoBedPrice,
    infantPrice: r.infantPrice,
    localPriceText: r.localPriceText,
    statusRaw: r.statusRaw,
    seatsStatusRaw: r.seatsStatusRaw,
    baselineAdultPrice: r.baselineAdultPrice,
    syncedAt: r.syncedAt?.toISOString() ?? null,
  }))
}

export async function backupModetourPriceAndDepartures(
  prisma: PrismaClient,
  productId: string,
  backupDir: string,
): Promise<string> {
  const [prices, departures, product] = await Promise.all([
    prisma.productPrice.findMany({ where: { productId }, orderBy: { date: 'asc' } }),
    prisma.productDeparture.findMany({ where: { productId }, orderBy: { departureDate: 'asc' } }),
    prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        slug: true,
        title: true,
        publicDetailPayloadBuiltAt: true,
        lastPriceObservedAt: true,
      },
    }),
  ])
  fs.mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const label = product?.slug?.trim() || productId
  const safeLabel = label.replace(/[^\w.-]+/g, '_').slice(0, 64)
  const filePath = path.join(backupDir, `modetour-price-sync-${safeLabel}-${stamp}.json`)
  const payload = {
    backedUpAt: new Date().toISOString(),
    productId,
    slug: product?.slug ?? null,
    title: product?.title ?? null,
    publicDetailPayloadBuiltAt: product?.publicDetailPayloadBuiltAt?.toISOString() ?? null,
    lastPriceObservedAt: product?.lastPriceObservedAt?.toISOString() ?? null,
    productPrices: serializePriceRows(prices),
    productDepartures: serializeDepartureRows(departures),
  }
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return filePath
}

function departureInputsToCalendarItems(inputs: DepartureInput[]): CalendarPriceApplyItem[] {
  const out: CalendarPriceApplyItem[] = []
  for (const inp of inputs) {
    const ymd = departureInputToYmd(inp.departureDate)
    if (!ymd) continue
    const adult = Number(inp.adultPrice ?? 0)
    if (!Number.isFinite(adult) || adult <= 0) continue
    out.push({
      date: ymd,
      price: adult,
      adultPrice: adult,
      statusRaw: inp.statusRaw ?? null,
      seatsStatusRaw: inp.seatsStatusRaw ?? null,
      childBedPrice: inp.childBedPrice ?? null,
      childNoBedPrice: inp.childNoBedPrice ?? null,
      infantPrice: inp.infantPrice ?? null,
      localPriceText: inp.localPriceText ?? null,
      minPax: inp.minPax ?? null,
      carrierName: inp.carrierName ?? null,
      outboundFlightNo: inp.outboundFlightNo ?? null,
      outboundDepartureAirport: inp.outboundDepartureAirport ?? null,
      outboundDepartureAt:
        inp.outboundDepartureAt instanceof Date
          ? inp.outboundDepartureAt.toISOString()
          : typeof inp.outboundDepartureAt === 'string'
            ? inp.outboundDepartureAt
            : null,
      outboundArrivalAirport: inp.outboundArrivalAirport ?? null,
      outboundArrivalAt:
        inp.outboundArrivalAt instanceof Date
          ? inp.outboundArrivalAt.toISOString()
          : typeof inp.outboundArrivalAt === 'string'
            ? inp.outboundArrivalAt
            : null,
      inboundFlightNo: inp.inboundFlightNo ?? null,
      inboundDepartureAirport: inp.inboundDepartureAirport ?? null,
      inboundDepartureAt:
        inp.inboundDepartureAt instanceof Date
          ? inp.inboundDepartureAt.toISOString()
          : typeof inp.inboundDepartureAt === 'string'
            ? inp.inboundDepartureAt
            : null,
      inboundArrivalAirport: inp.inboundArrivalAirport ?? null,
      inboundArrivalAt:
        inp.inboundArrivalAt instanceof Date
          ? inp.inboundArrivalAt.toISOString()
          : typeof inp.inboundArrivalAt === 'string'
            ? inp.inboundArrivalAt
            : null,
      meetingInfoRaw: inp.meetingInfoRaw ?? null,
      meetingPointRaw: inp.meetingPointRaw ?? null,
      meetingTerminalRaw: inp.meetingTerminalRaw ?? null,
      meetingGuideNoticeRaw: inp.meetingGuideNoticeRaw ?? null,
    })
  }
  return out
}

async function samplePriceState(prisma: PrismaClient, productId: string) {
  const [prices, departures] = await Promise.all([
    prisma.productPrice.findMany({ where: { productId }, select: { adult: true } }),
    prisma.productDeparture.findMany({
      where: { productId },
      select: { adultPrice: true },
    }),
  ])
  const adults = [
    ...prices.map((p) => p.adult),
    ...departures.map((d) => d.adultPrice).filter((v): v is number => v != null),
  ]
  const minAdult = adults.length ? Math.min(...adults) : null
  return { prices: prices.length, departures: departures.length, minAdult }
}

export async function runSyncModetourPriceSingle(
  prisma: PrismaClient,
  opts: SyncModetourPriceSingleOpts,
): Promise<SyncModetourPriceSingleResult> {
  const product = await resolveModetourProductForSync(prisma, opts)
  const detailUrl =
    product.originUrl?.trim() ||
    buildDetailUrl(product.originSource ?? 'modetour', product.originCode ?? '')
  if (!detailUrl.startsWith('http')) {
    throw new Error(`유효한 modetour 상세 URL이 없습니다 (productId=${product.id})`)
  }

  const backupDir =
    opts.backupDir?.trim() ||
    path.join(process.cwd(), 'scripts', 'data', 'backups')
  const beforeSample = await samplePriceState(prisma, product.id)
  const backupPath = await backupModetourPriceAndDepartures(prisma, product.id, backupDir)

  let scrapedRowCount = 0
  let liveError: string | null = null
  let collectSource: string | null = 'modetour-adapter'
  let collectNotes: string[] = []
  let inputs: DepartureInput[] = []

  try {
    console.log(
      `[sync-modetour-price] B2C API 수집 시작 originUrl=${product.originUrl ?? detailUrl} monthsForward=${SCRAPE_DEFAULT_MONTHS_FORWARD}`,
    )
    const collected = await collectModetourDepartureInputs(product.originUrl ?? detailUrl, {
      monthsForward: SCRAPE_DEFAULT_MONTHS_FORWARD,
    })
    collectNotes = collected.meta.notes ?? []
    inputs = filterDepartureInputsOnOrAfterCalendarToday(collected.inputs)
    scrapedRowCount = collected.inputs.length
    if (inputs.length === 0) {
      liveError =
        collected.inputs.length === 0
          ? `modetour B2C API: 출발 0건 (${collected.meta.mappingStatus})`
          : 'modetour B2C API: KST 오늘 이후·성인가 필터 후 0건'
    }
  } catch (e) {
    liveError = e instanceof Error ? e.message : String(e)
    collectSource = 'modetour-adapter-error'
  }

  if (liveError || inputs.length === 0) {
    return {
      ok: false,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      detailUrl,
      backupPath,
      scrapedRowCount,
      acceptedCount: 0,
      productPriceCreated: 0,
      departuresUpserted: 0,
      payloadRebuilt: false,
      beforeSample,
      afterSample: beforeSample,
      liveError,
      collectSource,
      collectNotes,
    }
  }

  const calendarItems = departureInputsToCalendarItems(inputs)

  if (opts.dryRun) {
    const afterSample = beforeSample
    return {
      ok: true,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      detailUrl,
      backupPath,
      scrapedRowCount,
      acceptedCount: calendarItems.length,
      productPriceCreated: 0,
      departuresUpserted: 0,
      payloadRebuilt: false,
      beforeSample,
      afterSample,
      liveError: null,
      collectSource,
      collectNotes,
    }
  }

  const applied = await applyProductCalendarPriceItems(prisma, product.id, calendarItems)

  let payloadRebuilt = false
  if (!opts.skipPayloadRebuild) {
    await revalidateProductDetailCaches(product.id, product.slug)
    payloadRebuilt = true
  }

  const afterSample = await samplePriceState(prisma, product.id)

  return {
    ok: applied.accepted > 0,
    productId: product.id,
    slug: product.slug,
    title: product.title,
    detailUrl,
    backupPath,
    scrapedRowCount,
    acceptedCount: applied.accepted,
    productPriceCreated: applied.productPriceCreated,
    departuresUpserted: applied.departuresUpserted,
    payloadRebuilt,
    beforeSample,
    afterSample,
    liveError: null,
    collectSource,
    collectNotes,
  }
}
