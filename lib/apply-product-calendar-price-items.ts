/**
 * calendar-prices POST 와 동일 SSOT — 스크립트·스케줄러가 API 없이 DB 반영할 때 사용.
 */
import type { PrismaClient } from '@prisma/client'
import { updateLastPriceObservedAt } from '@/lib/product-price-freshness'
import { priceSlotKeyFromDate } from '@/lib/departure-slot-key'
import {
  calendarPricesRejectReason,
  resolveCalendarPricesAdultKrw,
  type CalendarPricesItemLike,
} from '@/lib/calendar-prices-adult-floor'
import * as updDeparturesHanatour from '@/lib/upsert-product-departures-hanatour'
import * as updDeparturesModetour from '@/lib/upsert-product-departures-modetour'
import * as updDeparturesVerygoodtour from '@/lib/upsert-product-departures-verygoodtour'
import * as updDeparturesYbtour from '@/lib/upsert-product-departures-ybtour'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

export type CalendarPriceApplyItem = CalendarPricesItemLike & {
  status?: string
  statusRaw?: string | null
  seatsStatusRaw?: string | null
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

function pickPreservedChildInfantPriceForCalendar(
  incoming: number | null | undefined,
  existing: number | null | undefined,
): number | null {
  if (incoming !== undefined && incoming !== null && Number.isFinite(incoming)) {
    return incoming
  }
  if (existing !== undefined && existing !== null && Number.isFinite(existing)) {
    return existing
  }
  return null
}

function upsertDeparturesModuleForProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}) {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource)
  if (fromBrand === 'modetour') return updDeparturesModetour
  if (fromBrand === 'verygoodtour') return updDeparturesVerygoodtour
  if (fromBrand === 'ybtour') return updDeparturesYbtour
  if (norm === 'modetour') return updDeparturesModetour
  if (norm === 'verygoodtour') return updDeparturesVerygoodtour
  if (norm === 'ybtour') return updDeparturesYbtour
  return updDeparturesHanatour
}

export type ApplyProductCalendarPriceItemsResult = {
  received: number
  accepted: number
  rejectedBelowMinPrice: number
  rejectedInvalidPrice: number
  rejectedMissingDate: number
  rejectedTotal: number
  productPriceCreated: number
  departuresUpserted: number
}

export async function applyProductCalendarPriceItems(
  prisma: PrismaClient,
  productId: string,
  items: CalendarPriceApplyItem[],
): Promise<ApplyProductCalendarPriceItemsResult> {
  const empty: ApplyProductCalendarPriceItemsResult = {
    received: items.length,
    accepted: 0,
    rejectedBelowMinPrice: 0,
    rejectedInvalidPrice: 0,
    rejectedMissingDate: 0,
    rejectedTotal: 0,
    productPriceCreated: 0,
    departuresUpserted: 0,
  }
  if (items.length === 0) return empty

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, originSource: true, brand: { select: { brandKey: true } } },
  })
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }

  let rejectedInvalidPrice = 0
  let rejectedBelowMinPrice = 0
  let rejectedMissingDate = 0

  const normalized = items
    .map((i) => {
      const adultKrw = resolveCalendarPricesAdultKrw(i)
      const reject = calendarPricesRejectReason(i, adultKrw)
      if (reject === 'missing_date') {
        rejectedMissingDate += 1
        return null
      }
      if (reject === 'invalid_price') {
        rejectedInvalidPrice += 1
        return null
      }
      if (reject === 'below_min_price') {
        rejectedBelowMinPrice += 1
        return null
      }
      const d = i.date!.trim()
      const date = new Date(d)
      if (Number.isNaN(date.getTime())) {
        rejectedInvalidPrice += 1
        return null
      }
      const p = adultKrw!
      return {
        date,
        adult: p,
        statusRaw: i.statusRaw?.trim() || i.status?.trim() || null,
        seatsStatusRaw: i.seatsStatusRaw?.trim() || null,
        adultPrice: p,
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
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const rejectedTotal = rejectedMissingDate + rejectedInvalidPrice + rejectedBelowMinPrice
  if (normalized.length === 0) {
    return {
      ...empty,
      rejectedBelowMinPrice,
      rejectedInvalidPrice,
      rejectedMissingDate,
      rejectedTotal,
    }
  }

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
        priceSlotKey: priceSlotKeyFromDate(n.date),
        adult: n.adult,
        childBed,
        childNoBed,
        infant,
      }
    }),
  })
  if (created.count > 0) await updateLastPriceObservedAt(prisma, productId)

  const departuresUpserted = await upsertDeparturesModuleForProduct(product).upsertProductDepartures(
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
    }),
  )

  await prisma.scraperQueue.deleteMany({ where: { productId } }).catch(() => {})

  return {
    received: items.length,
    accepted: normalized.length,
    rejectedBelowMinPrice,
    rejectedInvalidPrice,
    rejectedMissingDate,
    rejectedTotal,
    productPriceCreated: created.count,
    departuresUpserted,
  }
}
