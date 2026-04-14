'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { sanitizeDetailText } from '@/lib/sanitize-text'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { parseShoppingStopsJson } from '@/lib/public-product-extras'
import * as publicConsumptionHanatour from '@/lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '@/lib/public-consumption-modetour'
import * as publicConsumptionVerygoodtour from '@/lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '@/lib/public-consumption-ybtour'
import type { FlightStructured } from '@/lib/detail-body-parser'
import * as fmcHanatour from '@/lib/flight-manual-correction-hanatour'
import * as fmcModetour from '@/lib/flight-manual-correction-modetour'
import * as fmcVerygood from '@/lib/flight-manual-correction-verygoodtour'
import * as fmcYbtour from '@/lib/flight-manual-correction-ybtour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_HANATOUR } from '@/lib/admin-register-verification-meta-hanatour'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_MODETOUR } from '@/lib/admin-register-verification-meta-modetour'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_VERYGOODTOUR } from '@/lib/admin-register-verification-meta-verygoodtour'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_YBTOUR } from '@/lib/admin-register-verification-meta-ybtour'
import type { AdminDeparturesRescrapeResponseBody } from '@/app/api/admin/products/[id]/departures/route'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { readAdminProductSupplierDerivatives } from '@/lib/admin-product-supplier-derivatives'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { repairUtf8MisreadAsLatin1 } from '@/lib/encoding-repair'
import {
  LISTING_KIND_LABELS,
  LISTING_KIND_VALUES,
  TRAVEL_SCOPE_LABELS,
  TRAVEL_SCOPE_VALUES,
} from '@/lib/product-listing-kind'
import { adminProductBgImageAttributionLine, adminProductBgImageSourceTypeLabel } from '@/lib/product-bg-image-attribution'
import {
  ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS,
  adminManualPrimaryHeroUploadAndPatch,
  type AdminManualPrimaryHeroUploadPreset,
} from '@/lib/admin-manual-primary-hero-upload'

type ProductPrice = {
  id: string
  date: string
  adult: number
  childBed: number | null
  childNoBed: number | null
  infant: number | null
  priceGap: number | null
}

type ScheduleEntry = {
  day: number
  title?: string
  description?: string
  imageKeyword?: string
  imageUrl?: string | null
  imageSource?: { source?: string; photographer?: string; originalLink?: string }
}

type PromotionReferencePrices = {
  basePrice: number | null
  salePrice: number | null
}

type Product = {
  id: string
  originSource: string
  originCode: string
  originUrl?: string | null
  title: string
  destination: string | null
  destinationRaw?: string | null
  primaryDestination?: string | null
  supplierGroupId?: string | null
  productType?: string | null
  airtelHotelInfoJson?: string | null
  airportTransferType?: string | null
  optionalToursStructured?: string | null
  priceFrom?: number | null
  priceCurrency?: string | null
  duration: string | null
  airline: string | null
  schedule: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  includedText: string | null
  excludedText: string | null
  hotelSummaryRaw: string | null
  criticalExclusions: string | null
  shoppingCount: number | null
  shoppingItems: string | null
  shoppingShopOptions?: string | null
  registrationStatus: string | null
  /** rawMeta.pricePromotion.merged — 사용자 취소선과 별개 */
  promotionReferencePrices?: PromotionReferencePrices | null
  bgImageUrl?: string | null
  bgImageSource?: string | null
  bgImagePhotographer?: string | null
  bgImageSourceUrl?: string | null
  bgImageExternalId?: string | null
  bgImageIsGenerated?: boolean
  needsImageReview?: boolean
  imageReviewRequestedAt?: string | null
  prices: ProductPrice[]
  itineraries: { id: number; day: number; description: string }[]
  optionalTours: { id: string; name: string; priceUsd: number; duration: string | null }[]
  rawMeta?: string | null
  counselingNotes?: string | null
  flightAdminJson?: string | null
  flightManualCorrection?: FlightManualCorrectionPayload | null
  brand?: { brandKey?: string | null } | null
  /** GET/PATCH 응답 파생 — DB 비저장, canonical supplier 기준 */
  canonicalBrandKey?: CanonicalOverseasSupplierKey | null
  normalizedOriginSupplier?: OverseasSupplierKey
  benefitSummary?: string | null
  updatedAt?: string
  /** domestic | overseas — 미설정 시 공개 browse는 기존 목적지/제목 트리아지 */
  travelScope?: string | null
  /** travel | private_trip | air_hotel_free — 미설정 시 제목·유형 추론 */
  listingKind?: string | null
}

function fmcModuleForAdminProduct(
  brandKey: string | null | undefined,
  originSource: string | null | undefined
) {
  switch (resolvePublicConsumptionModuleKey(brandKey, originSource)) {
    case 'modetour':
      return fmcModetour
    case 'verygoodtour':
      return fmcVerygood
    case 'ybtour':
      return fmcYbtour
    default:
      return fmcHanatour
  }
}

function registerPublicPageTraceBulletsForProduct(
  brandKey: string | null | undefined,
  originSource: string | null | undefined
): readonly string[] {
  switch (resolvePublicConsumptionModuleKey(brandKey, originSource)) {
    case 'hanatour':
      return REGISTER_PUBLIC_PAGE_TRACE_BULLETS_HANATOUR
    case 'modetour':
      return REGISTER_PUBLIC_PAGE_TRACE_BULLETS_MODETOUR
    case 'verygoodtour':
      return REGISTER_PUBLIC_PAGE_TRACE_BULLETS_VERYGOODTOUR
    case 'ybtour':
      return REGISTER_PUBLIC_PAGE_TRACE_BULLETS_YBTOUR
  }
}

/** GET /api/admin/products/[id]/itinerary-days 응답 1건 */
type ItineraryDayRow = {
  id: string
  productId: string
  day: number
  dateText: string | null
  city: string | null
  summaryTextRaw: string | null
  poiNamesRaw: string | null
  meals: string | null
  accommodation: string | null
  transport: string | null
  notes: string | null
  rawBlock: string | null
}

/** GET /api/admin/products/[id]/departures 응답 1건 */
type DepartureRow = {
  id: string
  productId: string
  departureDate: string
  adultPrice: number | null
  childBedPrice: number | null
  childNoBedPrice: number | null
  infantPrice: number | null
  localPriceText: string | null
  statusRaw: string | null
  seatsStatusRaw: string | null
  isConfirmed: boolean | null
  isBookable: boolean | null
  minPax: number | null
  syncedAt: string | null
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
}

type OptionalTourDraft = {
  id: string
  name: string
  priceText: string
  priceValue: string
  currency: string
  description: string
  bookingType: 'onsite' | 'pre' | 'inquire' | 'unknown'
  sortOrder: number
  rawText: string
  autoExtracted: boolean
}

type StructuredSectionView = {
  key: 'flight' | 'hotel' | 'optional' | 'shopping' | 'includedExcluded'
  label: string
  rawPresent: boolean
  structuredSummary: string
}

type StructuredSignalsView = {
  review: { required: string[]; warning: string[]; info: string[] } | null
  flightStatus: 'success' | 'partial' | 'failure' | null
  exposurePolicy: 'public_full' | 'public_limited' | 'admin_only' | null
  sections: StructuredSectionView[]
  publicConsumption: Array<{
    key: 'hotel' | 'optional' | 'shopping'
    label: string
    source: string
    mode: 'canonical-first' | 'legacy-fallback' | 'none'
  }>
} | null

function formatDepartureDt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

/** UTF-8→latin1 오인 한글 깨짐(상태·항공 등) 복구 후 표시 */
function adminDepartureText(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  return repairUtf8MisreadAsLatin1(s)
}

function hasFlightOrMeeting(r: DepartureRow): boolean {
  return !!(
    r.carrierName ||
    r.outboundFlightNo ||
    r.outboundDepartureAirport ||
    r.outboundDepartureAt ||
    r.outboundArrivalAirport ||
    r.outboundArrivalAt ||
    r.inboundFlightNo ||
    r.inboundDepartureAirport ||
    r.inboundDepartureAt ||
    r.inboundArrivalAirport ||
    r.inboundArrivalAt ||
    r.meetingInfoRaw ||
    r.meetingPointRaw ||
    r.meetingTerminalRaw ||
    r.meetingGuideNoticeRaw
  )
}

const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"%3E%3Crect fill="%23e2e8f0" width="200" height="120"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12"%3E이미지 없음%3C/text%3E%3C/svg%3E'

function parseSchedule(schedule: string | null): ScheduleEntry[] {
  if (!schedule || typeof schedule !== 'string') return []
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: Record<string, unknown>) => ({
      day: Number(item.day) ?? 0,
      title: typeof item.title === 'string' ? item.title : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      imageKeyword: typeof item.imageKeyword === 'string' ? item.imageKeyword : undefined,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : (item.imageUrl as string | null) ?? null,
      imageSource:
        item.imageSource && typeof item.imageSource === 'object'
          ? (item.imageSource as ScheduleEntry['imageSource'])
          : undefined,
    }))
  } catch {
    return []
  }
}

function parseAirtelHotelInfo(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

function parseOptionalToursDraft(raw: string | null | undefined): OptionalTourDraft[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row, idx) => {
        const bookingType: OptionalTourDraft['bookingType'] =
          row.bookingType === 'onsite' || row.bookingType === 'pre' || row.bookingType === 'inquire' || row.bookingType === 'unknown'
            ? row.bookingType
            : 'unknown'
        return {
        id: typeof row.id === 'string' ? row.id : `tour-${idx + 1}`,
        name: typeof row.name === 'string' ? row.name : '',
        priceText: typeof row.priceText === 'string' ? row.priceText : '',
        priceValue: typeof row.priceValue === 'number' ? String(row.priceValue) : '',
        currency: typeof row.currency === 'string' ? row.currency : '',
        description: typeof row.description === 'string' ? row.description : '',
        bookingType,
        sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : idx,
        rawText: typeof row.rawText === 'string' ? row.rawText : '',
        autoExtracted: row.autoExtracted === true,
      }})
      .sort((a, b) => a.sortOrder - b.sortOrder)
  } catch {
    return []
  }
}

function parseDetailBodyReviewFromRawMeta(rawMeta: string | null | undefined): { required: string[]; warning: string[]; info: string[] } | null {
  if (!rawMeta?.trim()) return null
  try {
    const parsed = JSON.parse(rawMeta) as Record<string, unknown>
    const structured = parsed.structuredSignals as Record<string, unknown> | undefined
    const review = structured?.detailBodyReview as Record<string, unknown> | undefined
    if (!review || typeof review !== 'object') return null
    const toArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [])
    return {
      required: toArr(review.required),
      warning: toArr(review.warning),
      info: toArr(review.info),
    }
  } catch {
    return null
  }
}

function parseStructuredSignalsView(
  rawMeta: string | null | undefined,
  product?: { optionalToursStructured?: string | null; shoppingShopOptions?: string | null; hotelSummaryRaw?: string | null },
  originSource?: string | null,
  brandKey?: string | null | undefined
): StructuredSignalsView {
  if (!rawMeta?.trim()) return null
  try {
    const parsed = JSON.parse(rawMeta) as Record<string, unknown>
    const s = parsed.structuredSignals as Record<string, unknown> | undefined
    if (!s || typeof s !== 'object') return null
    const reviewRaw = s.detailBodyReview as Record<string, unknown> | undefined
    const toArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [])
    const review = reviewRaw
      ? {
          required: toArr(reviewRaw.required),
          warning: toArr(reviewRaw.warning),
          info: toArr(reviewRaw.info),
        }
      : null
    const fs = s.flightStructured as Record<string, unknown> | undefined
    const fDebug = fs?.debug as Record<string, unknown> | undefined
    const flightStatus =
      fDebug?.status === 'success' || fDebug?.status === 'partial' || fDebug?.status === 'failure'
        ? (fDebug.status as 'success' | 'partial' | 'failure')
        : null
    const exposurePolicy =
      fDebug?.exposurePolicy === 'public_full' ||
      fDebug?.exposurePolicy === 'public_limited' ||
      fDebug?.exposurePolicy === 'admin_only'
        ? (fDebug.exposurePolicy as 'public_full' | 'public_limited' | 'admin_only')
        : null
    const hotelRows = Array.isArray((s.hotelStructured as Record<string, unknown> | undefined)?.rows)
      ? ((s.hotelStructured as { rows: unknown[] }).rows.length ?? 0)
      : 0
    const optionalRows = Array.isArray((s.optionalToursStructuredCanonical as Record<string, unknown> | undefined)?.rows)
      ? ((s.optionalToursStructuredCanonical as { rows: unknown[] }).rows.length ?? 0)
      : 0
    const shoppingRows = Array.isArray((s.shoppingStructured as Record<string, unknown> | undefined)?.rows)
      ? ((s.shoppingStructured as { rows: unknown[] }).rows.length ?? 0)
      : 0
    const includedRows =
      (Array.isArray((s.includedExcludedStructured as Record<string, unknown> | undefined)?.includedItems)
        ? ((s.includedExcludedStructured as { includedItems: unknown[] }).includedItems.length ?? 0)
        : 0) +
      (Array.isArray((s.includedExcludedStructured as Record<string, unknown> | undefined)?.excludedItems)
        ? ((s.includedExcludedStructured as { excludedItems: unknown[] }).excludedItems.length ?? 0)
        : 0)
    const consumptionKey = resolvePublicConsumptionModuleKey(brandKey, originSource)
    const optionalCanonical = s.optionalToursStructuredCanonical as
      | {
          rows?: Array<{
            tourName?: string
            currency?: string
            adultPrice?: number | null
            childPrice?: number | null
            durationText?: string
            minPeopleText?: string
            guide同行Text?: string
            waitingPlaceText?: string
            descriptionText?: string
            noteText?: string
          }>
        }
      | null
      | undefined
    const optionalLegacy = product?.optionalToursStructured ?? null
    const optionalConsumption =
      consumptionKey === 'modetour'
        ? publicConsumptionModetour.resolveOptionalToursConsumption({
            canonical: optionalCanonical,
            legacyOptionalToursStructured: optionalLegacy,
          })
        : consumptionKey === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveOptionalToursConsumption({
              canonical: optionalCanonical,
              legacyOptionalToursStructured: optionalLegacy,
            })
          : consumptionKey === 'ybtour'
            ? publicConsumptionYbtour.resolveOptionalToursConsumption({
                canonical: optionalCanonical,
                legacyOptionalToursStructured: optionalLegacy,
              })
            : publicConsumptionHanatour.resolveOptionalToursConsumption({
                canonical: optionalCanonical,
                legacyOptionalToursStructured: optionalLegacy,
              })
    const shoppingCanonical = s.shoppingStructured as
      | {
          rows?: Array<{
            shoppingItem?: string
            shoppingPlace?: string
            durationText?: string
            refundPolicyText?: string
            noteText?: string
          }>
        }
      | null
      | undefined
    const shoppingLegacyDb = parseShoppingStopsJson(product?.shoppingShopOptions ?? null)
    const shoppingLegacyMeta = parseShoppingStopsJson(String(s.shoppingStops ?? '') || null)
    const shoppingConsumption =
      consumptionKey === 'modetour'
        ? publicConsumptionModetour.resolveShoppingConsumption({
            canonical: shoppingCanonical,
            legacyDbRows: shoppingLegacyDb,
            legacyMetaRows: shoppingLegacyMeta,
          })
        : consumptionKey === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveShoppingConsumption({
              canonical: shoppingCanonical,
              legacyDbRows: shoppingLegacyDb,
              legacyMetaRows: shoppingLegacyMeta,
            })
          : consumptionKey === 'ybtour'
            ? publicConsumptionYbtour.resolveShoppingConsumption({
                canonical: shoppingCanonical,
                legacyDbRows: shoppingLegacyDb,
                legacyMetaRows: shoppingLegacyMeta,
              })
            : publicConsumptionHanatour.resolveShoppingConsumption({
                canonical: shoppingCanonical,
                legacyDbRows: shoppingLegacyDb,
                legacyMetaRows: shoppingLegacyMeta,
              })
    const hotelCanonical = s.hotelStructured as
      | {
          rows?: Array<{
            dayLabel?: string
            dateText?: string
            cityText?: string
            bookingStatusText?: string
            hotelNameText?: string
            hotelCandidates?: string[]
            noteText?: string
          }>
        }
      | null
      | undefined
    const hotelLegacyPlans = Array.isArray(s.dayHotelPlans) ? (s.dayHotelPlans as any[]) : null
    const hotelLegacyNarrative = Boolean(
      String(s.hotelInfoRaw ?? '').trim() || String(product?.hotelSummaryRaw ?? '').trim()
    )
    const hotelConsumption =
      consumptionKey === 'modetour'
        ? publicConsumptionModetour.resolveHotelConsumption({
            canonical: hotelCanonical,
            legacyStructuredPlans: hotelLegacyPlans,
            hasLegacyNarrativeFallback: hotelLegacyNarrative,
          })
        : consumptionKey === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveHotelConsumption({
              canonical: hotelCanonical,
              legacyStructuredPlans: hotelLegacyPlans,
              hasLegacyNarrativeFallback: hotelLegacyNarrative,
            })
          : consumptionKey === 'ybtour'
            ? publicConsumptionYbtour.resolveHotelConsumption({
                canonical: hotelCanonical,
                legacyStructuredPlans: hotelLegacyPlans,
                hasLegacyNarrativeFallback: hotelLegacyNarrative,
              })
            : publicConsumptionHanatour.resolveHotelConsumption({
                canonical: hotelCanonical,
                legacyStructuredPlans: hotelLegacyPlans,
                hasLegacyNarrativeFallback: hotelLegacyNarrative,
              })

    return {
      review,
      flightStatus,
      exposurePolicy,
      sections: [
        {
          key: 'flight',
          label: '항공',
          rawPresent: Boolean(String(s.flightRaw ?? '').trim()),
          structuredSummary: `status=${flightStatus ?? '-'} / exposure=${exposurePolicy ?? '-'}`,
        },
        {
          key: 'hotel',
          label: '호텔',
          rawPresent: Boolean(String(s.hotelPasteRaw ?? '').trim()),
          structuredSummary: `rows=${hotelRows}`,
        },
        {
          key: 'optional',
          label: '선택관광',
          rawPresent: Boolean(String(s.optionalToursPasteRaw ?? '').trim()),
          structuredSummary: `rows=${optionalRows}`,
        },
        {
          key: 'shopping',
          label: '쇼핑',
          rawPresent: Boolean(String(s.shoppingPasteRaw ?? '').trim()),
          structuredSummary: `rows=${shoppingRows}`,
        },
        {
          key: 'includedExcluded',
          label: '포함/불포함',
          rawPresent: false,
          structuredSummary: `items=${includedRows}`,
        },
      ],
      publicConsumption: [
        {
          key: 'hotel',
          label: '호텔',
          source: hotelConsumption.source,
          mode:
            hotelConsumption.source === 'none'
              ? 'none'
              : hotelConsumption.usedFallback
                ? 'legacy-fallback'
                : 'canonical-first',
        },
        {
          key: 'optional',
          label: '선택관광',
          source: optionalConsumption.source,
          mode:
            optionalConsumption.source === 'none'
              ? 'none'
              : optionalConsumption.usedFallback
                ? 'legacy-fallback'
                : 'canonical-first',
        },
        {
          key: 'shopping',
          label: '쇼핑',
          source: shoppingConsumption.source,
          mode:
            shoppingConsumption.source === 'none'
              ? 'none'
              : shoppingConsumption.usedFallback
                ? 'legacy-fallback'
                : 'canonical-first',
        },
      ],
    }
  } catch {
    return null
  }
}

function parseFlightStructuredFromRawMeta(rawMeta: string | null | undefined): FlightStructured | null {
  if (!rawMeta?.trim()) return null
  try {
    const o = JSON.parse(rawMeta) as Record<string, unknown>
    const s = o.structuredSignals as Record<string, unknown> | undefined
    const fs = s?.flightStructured
    if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
    return fs as FlightStructured
  } catch {
    return null
  }
}

function parseFlatFlightNosFromRawMeta(rawMeta: string | null | undefined): {
  outboundFlightNo: string | null
  inboundFlightNo: string | null
} {
  if (!rawMeta?.trim()) return { outboundFlightNo: null, inboundFlightNo: null }
  try {
    const o = JSON.parse(rawMeta) as Record<string, unknown>
    const s = o.structuredSignals as Record<string, unknown> | undefined
    if (!s) return { outboundFlightNo: null, inboundFlightNo: null }
    return {
      outboundFlightNo: typeof s.outboundFlightNo === 'string' ? s.outboundFlightNo.trim() || null : null,
      inboundFlightNo: typeof s.inboundFlightNo === 'string' ? s.inboundFlightNo.trim() || null : null,
    }
  } catch {
    return { outboundFlightNo: null, inboundFlightNo: null }
  }
}

type FlightManualFormLegDraft = {
  airline: string
  departureAirport: string
  departureDate: string
  departureTime: string
  arrivalAirport: string
  arrivalDate: string
  arrivalTime: string
  flightNo: string
}

type FlightManualFormDraft = {
  outbound: FlightManualFormLegDraft
  inbound: FlightManualFormLegDraft
}

function emptyFlightManualLegDraft(): FlightManualFormLegDraft {
  return {
    airline: '',
    departureAirport: '',
    departureDate: '',
    departureTime: '',
    arrivalAirport: '',
    arrivalDate: '',
    arrivalTime: '',
    flightNo: '',
  }
}

function emptyFlightManualFormDraft(): FlightManualFormDraft {
  return {
    outbound: emptyFlightManualLegDraft(),
    inbound: emptyFlightManualLegDraft(),
  }
}

function trimField(s: string): string | null {
  const t = s.trim()
  return t || null
}

function legFinalFromDraft(d: FlightManualFormLegDraft) {
  return {
    airline: trimField(d.airline),
    departureAirport: trimField(d.departureAirport),
    departureDate: trimField(d.departureDate),
    departureTime: trimField(d.departureTime),
    arrivalAirport: trimField(d.arrivalAirport),
    arrivalDate: trimField(d.arrivalDate),
    arrivalTime: trimField(d.arrivalTime),
    flightNo: trimField(d.flightNo),
  }
}

function buildFlightManualCorrectionForSave(
  draft: FlightManualFormDraft,
  rawMeta: string | null | undefined,
  brandKey: string | null | undefined,
  originSource: string | null | undefined
): FlightManualCorrectionPayload | null {
  const f = fmcModuleForAdminProduct(brandKey, originSource)
  const fs = parseFlightStructuredFromRawMeta(rawMeta)
  let auto = f.extractFlightLegAutoFromFlightStructured(fs)
  auto = f.mergeFlatFlightNoIntoAuto(auto, parseFlatFlightNosFromRawMeta(rawMeta))
  const obF = legFinalFromDraft(draft.outbound)
  const ibF = legFinalFromDraft(draft.inbound)
  const hasOb = f.manualFinalLegHasAny(obF)
  const hasIb = f.manualFinalLegHasAny(ibF)
  if (!hasOb && !hasIb) return null
  return {
    outbound: {
      auto: auto.outbound,
      final: hasOb ? obF : null,
      reviewState: hasOb ? 'manually_edited' : 'auto',
    },
    inbound: {
      auto: auto.inbound,
      final: hasIb ? ibF : null,
      reviewState: hasIb ? 'manually_edited' : 'auto',
    },
  }
}

function draftFromFlightManualCorrection(fc: FlightManualCorrectionPayload | null | undefined): FlightManualFormDraft {
  const d = emptyFlightManualFormDraft()
  if (!fc) return d
  const ob = fc.outbound?.final
  const ib = fc.inbound?.final
  if (ob) {
    d.outbound = {
      airline: ob.airline ?? '',
      departureAirport: ob.departureAirport ?? '',
      departureDate: ob.departureDate ?? '',
      departureTime: ob.departureTime ?? '',
      arrivalAirport: ob.arrivalAirport ?? '',
      arrivalDate: ob.arrivalDate ?? '',
      arrivalTime: ob.arrivalTime ?? '',
      flightNo: ob.flightNo ?? '',
    }
  }
  if (ib) {
    d.inbound = {
      airline: ib.airline ?? '',
      departureAirport: ib.departureAirport ?? '',
      departureDate: ib.departureDate ?? '',
      departureTime: ib.departureTime ?? '',
      arrivalAirport: ib.arrivalAirport ?? '',
      arrivalDate: ib.arrivalDate ?? '',
      arrivalTime: ib.arrivalTime ?? '',
      flightNo: ib.flightNo ?? '',
    }
  }
  return d
}

function ScheduleImage({ url, alt }: { url: string | null | undefined; alt: string }) {
  const [broken, setBroken] = useState(false)
  const src = !url || broken ? FALLBACK_IMAGE : url
  return (
    <img
      src={src}
      alt={alt}
      className="h-24 w-full rounded object-cover"
      onError={() => setBroken(true)}
    />
  )
}

/** 대표 이미지 출처 편집(URL 유지) — 라벨은 image-asset SSOT + 상품 전용 키 */
const HERO_SOURCE_SELECT: { value: string; label: string }[] = [
  'photopool',
  'photo_owned',
  'istock',
  'pexels',
  'gemini',
  'gemini_auto',
  'gemini_manual',
  'manual',
  'other',
  'destination-set',
  'city-asset',
  'attraction-asset',
].map((value) => ({ value, label: adminProductBgImageSourceTypeLabel(value) }))

function PrimaryImagePreview({ url }: { url: string | null | undefined }) {
  const [broken, setBroken] = useState(false)
  const src = !url || broken ? FALLBACK_IMAGE : url
  return (
    <img
      src={src}
      alt="대표 이미지"
      className="max-h-48 w-full rounded-lg object-contain bg-bt-title"
      onError={() => setBroken(true)}
    />
  )
}

export default function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const showRegisterTrace = searchParams?.get('registerTrace') === '1'
  const isEditMode = pathname?.endsWith('/edit') ?? false
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState<string | null>(null)
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [priceForm, setPriceForm] = useState({
    adult: 0,
    childBed: '',
    childNoBed: '',
    infant: '',
  })
  const [savingPrice, setSavingPrice] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [generatingSchedule, setGeneratingSchedule] = useState(false)
  const [imageReviewSaving, setImageReviewSaving] = useState(false)
  const [imageReviewMessage, setImageReviewMessage] = useState<string | null>(null)
  const [primaryImageUploading, setPrimaryImageUploading] = useState(false)
  const [heroReselectBusy, setHeroReselectBusy] = useState(false)
  const [primaryImageMessage, setPrimaryImageMessage] = useState<string | null>(null)
  const [heroMetaDraft, setHeroMetaDraft] = useState({
    source: 'photopool',
    photographer: '',
    sourceUrl: '',
    externalId: '',
  })
  const [savingHeroMeta, setSavingHeroMeta] = useState(false)
  const [heroMetaMessage, setHeroMetaMessage] = useState<string | null>(null)
  const [manualHeroUploadPreset, setManualHeroUploadPreset] = useState<AdminManualPrimaryHeroUploadPreset>('photo_owned')
  const [manualHeroUploadOtherNote, setManualHeroUploadOtherNote] = useState('')
  const [itineraryDays, setItineraryDays] = useState<ItineraryDayRow[] | null>(null)
  const [departures, setDepartures] = useState<DepartureRow[] | null>(null)
  const [optionalToursDraft, setOptionalToursDraft] = useState<OptionalTourDraft[]>([])
  const [savingOptionalTours, setSavingOptionalTours] = useState(false)
  const [optionalToursSnapshot, setOptionalToursSnapshot] = useState('[]')
  const [publicDetailDraft, setPublicDetailDraft] = useState({ included: '', excluded: '' })
  const [savingPublicDetail, setSavingPublicDetail] = useState(false)
  const [rescraping, setRescraping] = useState(false)
  const [hanatourPickMonthYm, setHanatourPickMonthYm] = useState('')
  const [rescrapingHanatourMonth, setRescrapingHanatourMonth] = useState(false)
  /** POST /departures 직후 마지막 응답(live vs fallback 가시화) */
  const [departureRescrapeReport, setDepartureRescrapeReport] = useState<AdminDeparturesRescrapeResponseBody | null>(
    null
  )
  const [basicDraft, setBasicDraft] = useState({
    title: '',
    duration: '',
    airline: '',
    travelScope: '' as '' | 'domestic' | 'overseas',
    listingKind: '' as '' | 'travel' | 'private_trip' | 'air_hotel_free',
  })
  const [benefitDraft, setBenefitDraft] = useState('')
  const [counselingDraft, setCounselingDraft] = useState('')
  const [flightAdminDraft, setFlightAdminDraft] = useState('')
  const [savingBasic, setSavingBasic] = useState(false)
  const [savingBenefit, setSavingBenefit] = useState(false)
  const [savingCounseling, setSavingCounseling] = useState(false)
  const [savingFlightAdmin, setSavingFlightAdmin] = useState(false)
  const [flightManualPanelOpen, setFlightManualPanelOpen] = useState(false)
  const [flightManualDraft, setFlightManualDraft] = useState(emptyFlightManualFormDraft())
  const [savingFlightManual, setSavingFlightManual] = useState(false)

  const supplierInternal = useMemo(() => {
    if (!product) return null
    const d = readAdminProductSupplierDerivatives(product)
    const effectiveCanonicalBrandKey = d.canonicalBrandKey ?? null
    const effectiveNormalizedOriginSupplier = d.normalizedOriginSupplier
    const brandForInternal = effectiveCanonicalBrandKey ?? product.brand?.brandKey ?? null
    const originForInternal =
      effectiveNormalizedOriginSupplier !== 'etc' ? effectiveNormalizedOriginSupplier : (product.originSource ?? '')
    return {
      effectiveCanonicalBrandKey,
      effectiveNormalizedOriginSupplier,
      brandForInternal,
      originForInternal,
    }
  }, [product])

  const flightManualContext = useMemo(() => {
    if (!product?.rawMeta || !supplierInternal) return null
    const f = fmcModuleForAdminProduct(supplierInternal.brandForInternal, supplierInternal.originForInternal)
    const fs = parseFlightStructuredFromRawMeta(product.rawMeta)
    let auto = f.extractFlightLegAutoFromFlightStructured(fs)
    auto = f.mergeFlatFlightNoIntoAuto(auto, parseFlatFlightNosFromRawMeta(product.rawMeta))
    const fc = product.flightManualCorrection
    const dbg = fs?.debug
    return {
      auto,
      fc,
      flightStatus: dbg?.status ?? null,
      exposurePolicy: dbg?.exposurePolicy ?? null,
    }
  }, [product?.rawMeta, product?.flightManualCorrection, product, supplierInternal])

  const isHanatourAdminProduct = useMemo(() => {
    if (!product || !supplierInternal) return false
    if (supplierInternal.effectiveCanonicalBrandKey === 'hanatour') return true
    if (supplierInternal.effectiveNormalizedOriginSupplier === 'hanatour') return true
    if (supplierInternal.effectiveNormalizedOriginSupplier !== 'etc') return false
    return (
      String(product.brand?.brandKey ?? '').trim() === 'hanatour' ||
      normalizeSupplierOrigin(product.originSource ?? '') === 'hanatour'
    )
  }, [product, supplierInternal])

  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!product) return
    setPublicDetailDraft({
      included: product.includedText ?? '',
      excluded: product.excludedText ?? '',
    })
  }, [product?.id, product?.includedText, product?.excludedText])

  useEffect(() => {
    if (!product) return
    setBasicDraft({
      title: product.title ?? '',
      duration: product.duration ?? '',
      airline: product.airline ?? '',
      travelScope:
        product.travelScope === 'domestic' || product.travelScope === 'overseas' ? product.travelScope : '',
      listingKind:
        product.listingKind === 'travel' ||
        product.listingKind === 'private_trip' ||
        product.listingKind === 'air_hotel_free'
          ? product.listingKind
          : '',
    })
    setBenefitDraft(product.benefitSummary ?? '')
    setCounselingDraft(product.counselingNotes ?? '')
    setFlightAdminDraft(product.flightAdminJson ?? '')
  }, [
    product?.id,
    product?.title,
    product?.duration,
    product?.airline,
    product?.travelScope,
    product?.listingKind,
    product?.benefitSummary,
    product?.counselingNotes,
    product?.flightAdminJson,
  ])

  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/products/${id}/itinerary-days`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ItineraryDayRow[]) => setItineraryDays(Array.isArray(data) ? data : []))
      .catch(() => setItineraryDays([]))
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/products/${id}/departures`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DepartureRow[]) => setDepartures(Array.isArray(data) ? data : []))
      .catch(() => setDepartures([]))
  }, [id])

  const fetchProduct = useCallback(() => {
    if (!id) return
    fetch(`/api/admin/products/${id}`)
      .then((r) => r.text())
      .then((text) => {
        let data: Product | null = null
        try {
          data = text ? (JSON.parse(text) as Product) : null
        } catch {
          // empty or invalid JSON
        }
        if (data) {
          setProduct(data)
          setScheduleEntries(parseSchedule(data?.schedule ?? null))
          const drafts = parseOptionalToursDraft(data?.optionalToursStructured ?? null)
          setOptionalToursDraft(drafts)
          setOptionalToursSnapshot(JSON.stringify(drafts))
          setScheduleDirty(false)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchProduct()
  }, [id, fetchProduct])

  /** 목록에서 보강 보내기 후 #admin-product-hero-image 로 들어올 때 스크롤 (클라이언트 전환 시 해시가 스크롤되지 않을 수 있음) */
  useEffect(() => {
    if (!product || loading) return
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#admin-product-hero-image') return
    const el = document.getElementById('admin-product-hero-image')
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => window.clearTimeout(t)
  }, [product?.id, loading])

  useEffect(() => {
    if (product?.prices?.[0]) {
      const p = product.prices[0]
      setPriceForm({
        adult: p.adult ?? 0,
        childBed: p.childBed != null ? String(p.childBed) : '',
        childNoBed: p.childNoBed != null ? String(p.childNoBed) : '',
        infant: p.infant != null ? String(p.infant) : '',
      })
    }
  }, [product?.prices])

  useEffect(() => {
    if (!product) return
    const src = (product.bgImageSource ?? '').trim().toLowerCase()
    const normalized = HERO_SOURCE_SELECT.some((o) => o.value === src) ? src : src ? 'manual' : 'photopool'
    setHeroMetaDraft({
      source: normalized,
      photographer: product.bgImagePhotographer ?? '',
      sourceUrl: product.bgImageSourceUrl ?? '',
      externalId: product.bgImageExternalId ?? '',
    })
  }, [
    product?.id,
    product?.bgImageSource,
    product?.bgImagePhotographer,
    product?.bgImageSourceUrl,
    product?.bgImageExternalId,
  ])

  const updateScheduleEntry = (index: number, field: keyof ScheduleEntry, value: string | number | null | undefined) => {
    setScheduleEntries((prev) => {
      const next = [...prev]
      const entry = { ...next[index] }
      if (field === 'imageKeyword') entry.imageKeyword = value as string
      if (field === 'title') entry.title = value as string
      if (field === 'description') entry.description = value as string
      next[index] = entry
      return next
    })
    setScheduleDirty(true)
  }

  const generateScheduleFromItineraries = async () => {
    const itineraries = product?.itineraries ?? []
    if (!id || itineraries.length === 0) return
    setGeneratingSchedule(true)
    try {
      const scheduleFromItineraries = itineraries.map((i) => ({
        day: i.day,
        title: '',
        description: i.description ?? '',
        imageKeyword: `day ${i.day} travel`,
        imageUrl: null as string | null,
        imageSource: undefined,
      }))
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: scheduleFromItineraries }),
      })
      const text = await res.text()
      let updated: Product | null = null
      try {
        updated = text ? (JSON.parse(text) as Product) : null
      } catch {
        // ignore
      }
      if (res.ok && updated) {
        setProduct(updated)
        setScheduleEntries(parseSchedule(updated?.schedule ?? null))
        setScheduleDirty(false)
      }
    } finally {
      setGeneratingSchedule(false)
    }
  }

  const saveSchedule = async () => {
    if (!id || !scheduleDirty) return
    setSavingSchedule(true)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: scheduleEntries }),
      })
      const text = await res.text()
      let updated: Product | null = null
      try {
        updated = text ? (JSON.parse(text) as Product) : null
      } catch {
        // empty or invalid JSON
      }
      if (res.ok && updated) {
        setProduct(updated)
        setScheduleEntries(parseSchedule(updated?.schedule ?? null))
        setScheduleDirty(false)
      }
    } finally {
      setSavingSchedule(false)
    }
  }

  const handlePrimaryImageUpload = async (file: File | null) => {
    if (!id || !file || !product) return
    setPrimaryImageUploading(true)
    setPrimaryImageMessage(null)
    try {
      const result = await adminManualPrimaryHeroUploadAndPatch(id, file, {
        preset: manualHeroUploadPreset,
        otherNote: manualHeroUploadOtherNote,
        cityName: product.destination ?? product.primaryDestination ?? 'City',
      })
      if (result.ok) {
        setProduct(result.product as Product)
        setPrimaryImageMessage('대표 이미지가 저장되었습니다.')
      } else {
        const prefix = result.stage === 'upload' ? '업로드 실패' : '저장 실패'
        setPrimaryImageMessage(`${prefix}: ${result.message}`)
      }
    } catch (e) {
      setPrimaryImageMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setPrimaryImageUploading(false)
    }
  }

  const pickScheduleEntryAsHero = async (entry: ScheduleEntry) => {
    if (!id || !entry.imageUrl?.trim()) return
    setHeroReselectBusy(true)
    setPrimaryImageMessage(null)
    try {
      const rawSrc = (entry.imageSource?.source ?? '').trim().toLowerCase()
      const mapped =
        rawSrc.includes('pexel') ? 'pexels'
        : rawSrc.includes('gemini') ? 'gemini_auto'
        : rawSrc.includes('pool') ? 'photopool'
        : 'manual'
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryImageUrl: entry.imageUrl.trim(),
          primaryImageSource: mapped,
          primaryImagePhotographer: entry.imageSource?.photographer?.trim() || null,
          primaryImageSourceUrl: entry.imageSource?.originalLink?.trim() || null,
        }),
      })
      const text = await res.text()
      let updated: Product | null = null
      try {
        updated = text ? (JSON.parse(text) as Product) : null
      } catch {
        /* ignore */
      }
      if (res.ok && updated) {
        setProduct(updated)
        setPrimaryImageMessage(`${entry.day}일차 이미지를 대표로 지정했습니다.`)
      } else {
        let errMsg = '저장 실패'
        try {
          const err = text ? (JSON.parse(text) as { error?: string }) : null
          if (err?.error) errMsg = err.error
        } catch {
          /* ignore */
        }
        setPrimaryImageMessage(errMsg)
      }
    } catch (e) {
      setPrimaryImageMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setHeroReselectBusy(false)
    }
  }

  const runTravelProcessImagesReselect = async () => {
    if (!id) return
    setHeroReselectBusy(true)
    setPrimaryImageMessage(null)
    try {
      const res = await fetch('/api/travel/process-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      })
      const text = await res.text()
      let j: { success?: boolean; error?: string } | null = null
      try {
        j = text ? (JSON.parse(text) as { success?: boolean; error?: string }) : null
      } catch {
        /* ignore */
      }
      if (!res.ok || !j?.success) {
        setPrimaryImageMessage(j?.error ?? text.slice(0, 200) ?? '이미지 재선정 실패')
        return
      }
      const dRes = await fetch(`/api/admin/products/${id}`)
      const dText = await dRes.text()
      let refreshed: Product | null = null
      try {
        refreshed = dText ? (JSON.parse(dText) as Product) : null
      } catch {
        /* ignore */
      }
      if (dRes.ok && refreshed) {
        setProduct(refreshed)
        setScheduleEntries(parseSchedule(refreshed.schedule ?? null))
        setPrimaryImageMessage('일정·대표 이미지가 재선정되었습니다.')
      } else {
        setPrimaryImageMessage('재선정은 완료되었으나 상품 새로고침에 실패했습니다. 페이지를 새로고침하세요.')
      }
    } catch (e) {
      setPrimaryImageMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setHeroReselectBusy(false)
    }
  }

  const saveHeroImageMeta = async () => {
    if (!id) return
    setSavingHeroMeta(true)
    setHeroMetaMessage(null)
    try {
      const srcNorm = heroMetaDraft.source.trim().toLowerCase()
      const derivedGenerated =
        srcNorm === 'gemini' || srcNorm === 'gemini_auto' || srcNorm === 'gemini_manual'
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryImageSource: heroMetaDraft.source.trim(),
          primaryImagePhotographer: heroMetaDraft.photographer.trim() || null,
          primaryImageSourceUrl: heroMetaDraft.sourceUrl.trim() || null,
          primaryImageExternalId: heroMetaDraft.externalId.trim() || null,
          primaryImageIsGenerated: derivedGenerated,
        }),
      })
      const text = await res.text()
      let updated: Product | null = null
      try {
        updated = text ? (JSON.parse(text) as Product) : null
      } catch {
        // ignore
      }
      if (res.ok && updated) {
        setProduct(updated)
        setHeroMetaMessage('대표 이미지 출처가 저장되었습니다.')
      } else {
        let errMsg = '저장 실패'
        try {
          const err = text ? (JSON.parse(text) as { error?: string }) : null
          if (err?.error) errMsg = err.error
        } catch {
          // ignore
        }
        setHeroMetaMessage(errMsg)
      }
    } catch (e) {
      setHeroMetaMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setSavingHeroMeta(false)
    }
  }

  if (loading || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bt-strong">
        <p className="text-sm text-bt-meta">로딩 중...</p>
      </div>
    )
  }

  const sanitizedIncluded = sanitizeDetailText(product.includedText)
  const sanitizedExcluded = sanitizeDetailText(product.excludedText)
  const sanitizedCritical = sanitizeDetailText(product.criticalExclusions)
  const hasScheduleImages = scheduleEntries.some((e) => e.imageUrl != null && e.imageUrl !== '')
  const airtelHotelInfo = parseAirtelHotelInfo(product.airtelHotelInfoJson)
  const optionalToursDirty = JSON.stringify(optionalToursDraft) !== optionalToursSnapshot
  const detailBodyReview = parseDetailBodyReviewFromRawMeta(product.rawMeta ?? null)
  const { brandForInternal, originForInternal } = supplierInternal!
  const structuredSignalsView = parseStructuredSignalsView(
    product.rawMeta ?? null,
    {
      optionalToursStructured: product.optionalToursStructured ?? null,
      shoppingShopOptions: product.shoppingShopOptions ?? null,
      hotelSummaryRaw: product.hotelSummaryRaw ?? null,
    },
    originForInternal,
    brandForInternal
  )

  async function savePublicDetailTexts() {
    if (!id) return
    setSavingPublicDetail(true)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includedText: publicDetailDraft.included,
          excludedText: publicDetailDraft.excluded,
        }),
      })
      const text = await res.text()
      const updated = text ? (JSON.parse(text) as Product) : null
      if (res.ok && updated) setProduct(updated)
    } finally {
      setSavingPublicDetail(false)
    }
  }

  async function saveOptionalTours() {
    if (!id) return
    setSavingOptionalTours(true)
    try {
      const normalized = optionalToursDraft
        .map((t, idx) => ({
          id: t.id || `tour-${idx + 1}`,
          name: t.name.trim(),
          priceText: t.priceText.trim(),
          priceValue: t.priceValue.trim() ? Number(t.priceValue.replace(/,/g, '')) : undefined,
          currency: t.currency.trim() || undefined,
          description: t.description.trim() || undefined,
          bookingType: t.bookingType,
          sortOrder: idx,
          rawText: t.rawText.trim() || undefined,
          autoExtracted: t.autoExtracted,
        }))
        .filter((t) => t.name.length > 0)
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionalToursStructured: JSON.stringify(normalized) }),
      })
      const text = await res.text()
      const updated = text ? (JSON.parse(text) as Product) : null
      if (res.ok && updated) {
        setProduct(updated)
        const drafts = parseOptionalToursDraft(updated.optionalToursStructured ?? null)
        setOptionalToursDraft(drafts)
        setOptionalToursSnapshot(JSON.stringify(drafts))
      }
    } finally {
      setSavingOptionalTours(false)
    }
  }

  return (
    <div className="min-h-screen bg-bt-strong text-bt-inverse">
      {hasScheduleImages && (
        <div className="border-b border-bt-success bg-bt-badge-domestic/25 px-4 py-2 text-center text-sm font-medium text-bt-badge-domestic-text">
          등록 준비 완료 — 이미지가 준비되었습니다. 내용을 검증한 뒤 등록을 완료하세요.
        </div>
      )}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-bt-border-strong bg-bt-title/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link href="/admin/products" className="text-sm text-bt-meta hover:text-bt-inverse">
            ← 목록
          </Link>
          <h1 className="max-w-xl truncate text-lg font-bold text-bt-inverse">{product.title}</h1>
          {isEditMode && (
            <span className="inline-flex rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              편집 모드
            </span>
          )}
          {product.updatedAt ? (
            <span className="hidden text-[11px] text-bt-subtle sm:inline">
              최근 저장: {new Date(product.updatedAt).toLocaleString('ko-KR')}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isEditMode && (
            <Link
              href={`/admin/products/${product.id}/edit`}
              className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              상품 편집
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              if (!id) return
              if (rescraping || rescrapingHanatourMonth) return
              setRescraping(true)
              setDepartureRescrapeReport(null)
              try {
                const postRes = await fetch(`/api/admin/products/${encodeURIComponent(id)}/departures`, {
                  method: 'POST',
                })
                const report = (await postRes.json().catch(() => null)) as AdminDeparturesRescrapeResponseBody | null
                if (report && typeof report === 'object') setDepartureRescrapeReport(report)
                const dRes = await fetch(`/api/admin/products/${id}/departures`)
                const d = dRes.ok ? await dRes.json() : []
                setDepartures(Array.isArray(d) ? d : [])
                if (postRes.ok || postRes.status === 422) fetchProduct()
              } finally {
                setRescraping(false)
              }
            }}
            disabled={rescraping || rescrapingHanatourMonth}
            className="rounded-lg border border-bt-border-strong bg-bt-title px-3 py-2 text-sm font-medium text-bt-meta hover:bg-bt-surface-soft disabled:opacity-50"
            title="하나투어: 당월부터 2개월만 수집·반영"
          >
            {rescraping ? '재수집 중…' : '재스크랩'}
          </button>
          {isHanatourAdminProduct ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                placeholder="YYYY-MM"
                value={hanatourPickMonthYm}
                onChange={(e) => setHanatourPickMonthYm(e.target.value)}
                className="w-[7.5rem] rounded border border-bt-border-strong bg-bt-title px-2 py-1.5 text-xs text-bt-inverse placeholder:text-bt-subtle"
                aria-label="수집할 달"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!id) return
                  if (rescraping || rescrapingHanatourMonth) return
                  const ym = hanatourPickMonthYm.trim()
                  if (!/^\d{4}-\d{2}$/.test(ym)) return
                  setRescrapingHanatourMonth(true)
                  setDepartureRescrapeReport(null)
                  try {
                    const q = new URLSearchParams({ hanatourMonth: ym })
                    const postRes = await fetch(
                      `/api/admin/products/${encodeURIComponent(id)}/departures?${q.toString()}`,
                      { method: 'POST' }
                    )
                    const report = (await postRes.json().catch(() => null)) as AdminDeparturesRescrapeResponseBody | null
                    if (report && typeof report === 'object') setDepartureRescrapeReport(report)
                    const dRes = await fetch(`/api/admin/products/${id}/departures`)
                    const d = dRes.ok ? await dRes.json() : []
                    setDepartures(Array.isArray(d) ? d : [])
                    if (postRes.ok || postRes.status === 422) fetchProduct()
                  } finally {
                    setRescrapingHanatourMonth(false)
                  }
                }}
                disabled={
                  rescraping ||
                  rescrapingHanatourMonth ||
                  !/^\d{4}-\d{2}$/.test(hanatourPickMonthYm.trim())
                }
                className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/50 disabled:opacity-50"
                title="지정한 한 달만 Python subprocess로 수집"
              >
                {rescrapingHanatourMonth ? '수집 중…' : '해당 달 수집'}
              </button>
            </span>
          ) : null}
          {product.originUrl ? (
            <a
              href={product.originUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-bt-border-strong bg-bt-title px-3 py-2 text-sm font-medium text-bt-meta hover:bg-bt-surface-soft"
            >
              원본 URL 열기
            </a>
          ) : null}
          <Link
            href={`/products/${product.id}`}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-bt-border-strong bg-bt-title px-3 py-2 text-sm font-medium text-bt-meta hover:bg-bt-surface-soft"
          >
            사용자 화면 보기
          </Link>
          <Link
            href={`/admin/products/${product.id}/customer-view`}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-cyan-700/60 bg-cyan-950/35 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-950/55"
            title="Admin preview route (works for draft products)"
          >
            Customer preview (admin)
          </Link>
          {product.registrationStatus !== 'registered' && (
            <button
              type="button"
              onClick={async () => {
                if (!id) return
                setRegistering(true)
                try {
                  const res = await fetch(`/api/admin/products/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registrationStatus: 'registered' }),
                  })
                  const text = await res.text()
                  let updated: Product | null = null
                  try {
                    updated = text ? (JSON.parse(text) as Product) : null
                  } catch {
                    // ignore
                  }
                  if (res.ok && updated) setProduct(updated)
                } finally {
                  setRegistering(false)
                }
              }}
              disabled={registering}
              className="rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
            >
              {registering ? '처리 중…' : '검수 후 등록'}
            </button>
          )}
        </div>
      </header>
      {departureRescrapeReport ? (
        <div
          className={`border-b px-4 py-2 text-[11px] leading-snug ${
            departureRescrapeReport.ok
              ? departureRescrapeReport.mode === 'fallback-rebuild' ||
                  departureRescrapeReport.collectorStatus === 'success_partial' ||
                  departureRescrapeReport.rescrapeOutcome === 'success_partial'
                ? 'border-amber-500/30 bg-amber-950/35 text-amber-50'
                : 'border-emerald-500/25 bg-emerald-950/25 text-emerald-50'
              : 'border-red-500/35 bg-red-950/30 text-red-50'
          }`}
        >
          <p className="font-semibold">
            출발일 재수집{' '}
            {departureRescrapeReport.ok
              ? departureRescrapeReport.collectorStatus === 'success_partial' ||
                  departureRescrapeReport.rescrapeOutcome === 'success_partial'
                ? '부분 성공'
                : '결과'
              : '실패'}{' '}
            · collectorStatus {departureRescrapeReport.collectorStatus ?? '—'} · mode {departureRescrapeReport.mode ?? '—'}{' '}
            · source {departureRescrapeReport.source ?? '—'}
          </p>
          {departureRescrapeReport.liveError ? (
            <p className="mt-0.5 opacity-95">live: {departureRescrapeReport.liveError}</p>
          ) : null}
          <p className="mt-0.5 text-[10px] opacity-90">
            수집 {departureRescrapeReport.collectedCount ?? 0}건 · 반영 {departureRescrapeReport.upsertedCount ?? 0}건
            {typeof departureRescrapeReport.productPriceSyncedCount === 'number'
              ? ` · ProductPrice 동기화 ${departureRescrapeReport.productPriceSyncedCount}건`
              : ''}
          </p>
          {departureRescrapeReport.productPriceSyncError ? (
            <p className="mt-0.5 text-[10px] text-red-200">ProductPrice 동기화 오류: {departureRescrapeReport.productPriceSyncError}</p>
          ) : null}
          {departureRescrapeReport.message ? (
            <p className="mt-1 text-[11px] whitespace-pre-wrap">{departureRescrapeReport.message}</p>
          ) : null}
          {departureRescrapeReport.hanatourMonthSummaryLines &&
          departureRescrapeReport.hanatourMonthSummaryLines.length > 0 ? (
            <ul className="mt-1 list-inside list-disc font-mono text-[10px] leading-relaxed opacity-95">
              {departureRescrapeReport.hanatourMonthSummaryLines.map((ln) => (
                <li key={ln}>{ln}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <p className="text-sm text-bt-meta">
            {formatOriginSourceForDisplay(originForInternal)} · {product.originCode} ·{' '}
            {product.primaryDestination ?? product.destination ?? '—'} · {product.duration ?? '—'}
            {product.airline && ` · ${product.airline}`}
          </p>
          {(product.destinationRaw != null && product.destinationRaw !== (product.primaryDestination ?? product.destination)) && (
            <p className="mt-0.5 text-xs text-bt-subtle">목적지 원문: {product.destinationRaw}</p>
          )}
          {(product.supplierGroupId != null || product.priceFrom != null) && (
            <p className="mt-1 text-sm text-bt-inverse/90">
              {product.supplierGroupId && <span>단체번호 {product.supplierGroupId}</span>}
              {product.supplierGroupId && product.priceFrom != null && ' · '}
              {product.priceFrom != null && (
                <span>
                  등록 시 대표 최저가(참고·DB) {product.priceFrom.toLocaleString()}
                  {product.priceCurrency ? ` ${product.priceCurrency}` : ''}
                </span>
              )}
            </p>
          )}
          {product.promotionReferencePrices?.basePrice != null &&
          product.promotionReferencePrices.basePrice > 0 &&
          (product.promotionReferencePrices.salePrice == null || product.promotionReferencePrices.salePrice <= 0) ? (
            <p className="mt-2 rounded border border-amber-400/60 bg-amber-950/40 p-2 text-[11px] leading-snug text-amber-100">
              <strong>사용자 취소선(쿠폰 적용 전) 비노출:</strong> 원문 메타에 salePrice가 없어 사용자 상세의 취소선 금액을 계산할 수
              없습니다. SSOT는 base·sale 쌍이 있을 때만 할인액을 추정합니다. 아래 base는 검수 참고용이며 사용자 노출 가격과
              다릅니다.
            </p>
          ) : null}
          {product.promotionReferencePrices?.basePrice != null && product.promotionReferencePrices.basePrice > 0 ? (
            <p className="mt-1 text-[11px] text-bt-subtle">
              등록 참고 — 공급사 추출 base(원문 메타): {product.promotionReferencePrices.basePrice.toLocaleString()}원
              {product.promotionReferencePrices.salePrice != null && product.promotionReferencePrices.salePrice > 0
                ? ` · sale: ${product.promotionReferencePrices.salePrice.toLocaleString()}원`
                : ''}
            </p>
          ) : null}
          {product.productType && (
            <p className="mt-1 text-xs text-bt-subtle">상품유형: {product.productType}</p>
          )}
          {(product.travelScope || product.listingKind) && (
            <p className="mt-1 text-xs text-bt-subtle">
              {product.travelScope
                ? `여행 범위: ${TRAVEL_SCOPE_LABELS[product.travelScope as keyof typeof TRAVEL_SCOPE_LABELS] ?? product.travelScope}`
                : null}
              {product.travelScope && product.listingKind ? ' · ' : null}
              {product.listingKind
                ? `상품 카테고리: ${LISTING_KIND_LABELS[product.listingKind as keyof typeof LISTING_KIND_LABELS] ?? product.listingKind}`
                : null}
            </p>
          )}
          {product.airportTransferType && (
            <p className="mt-1 text-xs text-bt-subtle">공항이동: {product.airportTransferType}</p>
          )}
          <p className="mt-1 text-xs">
            {product.originUrl ? (
              <a
                href={product.originUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-bt-inverse/90 hover:text-bt-inverse hover:underline"
              >
                원본 보기 ↗
              </a>
            ) : (
              <span className="text-bt-subtle">원본 URL 없음</span>
            )}
          </p>
          {(product.mandatoryLocalFee != null || product.mandatoryCurrency) && (
            <p className="mt-1 text-sm text-bt-warning">
              현지 지불: {product.mandatoryLocalFee != null ? product.mandatoryLocalFee : '—'} {product.mandatoryCurrency ?? ''}
            </p>
          )}
        </div>

        {isEditMode ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-bt-border-strong bg-bt-title/30 px-3 py-2 text-[11px] text-bt-meta">
            <span className="font-semibold text-bt-inverse/90">편집 바로가기</span>
            <a href="#ops-basic" className="text-sky-200 underline hover:text-white">
              기본정보
            </a>
            <span className="text-bt-subtle">·</span>
            <a href="#ops-benefit" className="text-sky-200 underline hover:text-white">
              혜택 요약
            </a>
            <span className="text-bt-subtle">·</span>
            <a href="#ops-flight" className="text-sky-200 underline hover:text-white">
              관리자 항공
            </a>
            <span className="text-bt-subtle">·</span>
            <a href="#ops-optional" className="text-sky-200 underline hover:text-white">
              현지옵션
            </a>
            <span className="text-bt-subtle">·</span>
            <a href="#ops-first-price" className="text-sky-200 underline hover:text-white">
              첫 출발일 요금
            </a>
            <span className="text-bt-subtle">·</span>
            <a href="#ops-memo" className="text-sky-200 underline hover:text-white">
              상담 메모
            </a>
          </div>
        ) : null}

        {isEditMode ? (
          <p className="mb-4 rounded border border-sky-500/35 bg-sky-950/25 px-3 py-2 text-[11px] leading-relaxed text-sky-100/95">
            이 화면의 저장은 모두 <strong className="text-white">기존 상품 PATCH(update)</strong>이며 신규 생성이 아닙니다.
            출발일별 가격·스크랩 데이터(ProductDeparture)는 <strong>재스크랩</strong>으로 동기화하고, 원문 일정표(ItineraryDay)는
            별도 수집 파이프라인을 따릅니다.
          </p>
        ) : null}
        {isEditMode ? (
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-400/35 bg-emerald-950/25 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-200">직접 수정 후 즉시 저장</p>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/90">
                기본정보, 혜택 요약, 관리자 항공 JSON, 상담 메모, 포함/불포함(호텔 수동란 없음), 현지옵션, 첫 출발일 요금
              </p>
            </div>
            <div className="rounded-lg border border-amber-400/35 bg-amber-950/25 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-200">재스크랩 후 반영</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-100/90">
                출발일별 가격/상태(ProductDeparture), 원문 일정표(ItineraryDay), 공급사 변동 항목
              </p>
            </div>
          </div>
        ) : null}
        {isEditMode && detailBodyReview ? (
          <section className="mb-4 rounded-lg border border-bt-border-strong bg-bt-title/40 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-bt-meta">본문 구조화 검수 상태</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-red-500/20 px-2 py-0.5 font-semibold text-red-200">
                required {detailBodyReview.required.length}
              </span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200">
                warning {detailBodyReview.warning.length}
              </span>
              <span className="rounded bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-200">
                info {detailBodyReview.info.length}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[11px] leading-relaxed">
              {detailBodyReview.required.slice(0, 2).map((r, i) => (
                <p key={`req_${i}`} className="text-red-100">
                  [required] {r}
                </p>
              ))}
              {detailBodyReview.warning.slice(0, 2).map((r, i) => (
                <p key={`warn_${i}`} className="text-amber-100">
                  [warning] {r}
                </p>
              ))}
              {detailBodyReview.info.slice(0, 2).map((r, i) => (
                <p key={`info_${i}`} className="text-sky-100">
                  [info] {r}
                </p>
              ))}
            </div>
          </section>
        ) : null}
        {isEditMode && showRegisterTrace ? (
          <section className="mb-4 rounded-lg border border-cyan-500/40 bg-cyan-950/30 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
              등록 실검증 · 공개 상세 소비 추적 (`?registerTrace=1`)
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-cyan-100/90">
              사용자 공개 상세(`/products/…`)는 아래 소스를 조합합니다. 미리보기의 <code className="rounded bg-black/30 px-1">registerVerification</code> 값과
              나란히 두고 차이를 확인하세요.
            </p>
            {id ? (
              <Link
                href={`/products/${id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-[11px] font-semibold text-cyan-200 underline hover:text-white"
              >
                공개 상세 새 탭 열기 →
              </Link>
            ) : null}
            {(() => {
              const traceBullets = registerPublicPageTraceBulletsForProduct(brandForInternal, originForInternal)
              return traceBullets.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-cyan-50/95">
                  {traceBullets.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-cyan-100/85">
                  이 상품의 <code className="rounded bg-black/30 px-1">originSource</code>는 네 공급사 키(hanatour, modetour, verygoodtour, ybtour)로 정규화되지 않아, 공급사 전용 추적 불릿을 표시하지 않습니다.
                </p>
              )
            })()}
            <p className="mt-2 text-[10px] text-cyan-200/80">
              편집 모드 하단의 「구조화 결과 가시화」「공개 소비 경로」 블록과 함께 보시면 preview → DB → public 추적이
              됩니다.
            </p>
          </section>
        ) : null}
        {isEditMode && structuredSignalsView ? (
          <section className="mb-4 rounded-lg border border-bt-border-strong bg-bt-title/40 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-bt-meta">구조화 결과 가시화 (raw / structured / final)</h3>
            <p className="mt-1 text-[11px] text-bt-subtle">
              운영 원칙: raw 수정 → 재파싱으로 structured 재생성. structured 직접 수동편집은 기본 경로가 아닙니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-200">
                flight status {structuredSignalsView.flightStatus ?? '-'}
              </span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-semibold text-indigo-200">
                exposure {structuredSignalsView.exposurePolicy ?? '-'}
              </span>
              <span className="rounded bg-red-500/20 px-2 py-0.5 font-semibold text-red-200">
                required {structuredSignalsView.review?.required.length ?? 0}
              </span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200">
                warning {structuredSignalsView.review?.warning.length ?? 0}
              </span>
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-semibold text-cyan-200">
                info {structuredSignalsView.review?.info.length ?? 0}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {structuredSignalsView.sections.map((sec) => (
                <div key={sec.key} className="rounded border border-bt-border-strong bg-bt-title/70 p-2">
                  <p className="text-[11px] font-semibold text-bt-inverse">{sec.label}</p>
                  <p className="mt-1 text-[11px] text-bt-meta">raw: {sec.rawPresent ? '입력됨' : '없음'}</p>
                  <p className="text-[11px] text-bt-subtle">structured: {sec.structuredSummary}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-bt-border-strong bg-bt-title/70 p-2">
              <p className="text-[11px] font-semibold text-bt-inverse">공개 소비 경로 (canonical-first / fallback hit)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {structuredSignalsView.publicConsumption.map((c) => (
                  <div key={c.key} className="rounded border border-bt-border-strong bg-bt-title/80 p-2">
                    <p className="text-[11px] font-semibold text-bt-inverse">{c.label}</p>
                    <p className="mt-1 text-[11px] text-bt-meta">
                      mode:{' '}
                      <span
                        className={
                          c.mode === 'canonical-first'
                            ? 'text-emerald-300'
                            : c.mode === 'legacy-fallback'
                              ? 'text-amber-300'
                              : 'text-slate-300'
                        }
                      >
                        {c.mode}
                      </span>
                    </p>
                    <p className="text-[11px] text-bt-subtle">source: {c.source}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section id="ops-basic" className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-bt-meta">기본 정보</h2>
          <div className="grid gap-3 sm:grid-cols-1">
            <label className="block text-[11px] text-bt-subtle">
              상품명
              <input
                value={basicDraft.title}
                onChange={(e) => setBasicDraft((d) => ({ ...d, title: e.target.value }))}
                className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] text-bt-subtle">
                여행기간 문구
                <input
                  value={basicDraft.duration}
                  onChange={(e) => setBasicDraft((d) => ({ ...d, duration: e.target.value }))}
                  className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                  placeholder="예: 3박 4일"
                />
              </label>
              <label className="block text-[11px] text-bt-subtle">
                항공사(표기)
                <input
                  value={basicDraft.airline}
                  onChange={(e) => setBasicDraft((d) => ({ ...d, airline: e.target.value }))}
                  className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] text-bt-subtle">
                여행 범위 <span className="text-bt-meta">(국내/해외)</span>
                <select
                  value={basicDraft.travelScope}
                  onChange={(e) =>
                    setBasicDraft((d) => ({
                      ...d,
                      travelScope: e.target.value as typeof d.travelScope,
                    }))
                  }
                  className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                >
                  <option value="">미설정 · 기존 목적지/제목 기준</option>
                  {TRAVEL_SCOPE_VALUES.map((k) => (
                    <option key={k} value={k}>
                      {TRAVEL_SCOPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-bt-subtle">
                상품 카테고리 <span className="text-bt-meta">(노출 유형)</span>
                <select
                  value={basicDraft.listingKind}
                  onChange={(e) =>
                    setBasicDraft((d) => ({
                      ...d,
                      listingKind: e.target.value as typeof d.listingKind,
                    }))
                  }
                  className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                >
                  <option value="">미설정 · 제목·유형 추론</option>
                  {LISTING_KIND_VALUES.map((k) => (
                    <option key={k} value={k}>
                      {LISTING_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-[10px] leading-relaxed text-bt-subtle">
              여행 범위와 상품 카테고리는 서로 다른 축입니다. 항공권+호텔(자유여행) 노출은 상품 카테고리에서 선택하세요.
            </p>
          </div>
          <button
            type="button"
            disabled={savingBasic || !id}
            onClick={async () => {
              if (!id) return
              setSavingBasic(true)
              try {
                const res = await fetch(`/api/admin/products/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: basicDraft.title.trim() || undefined,
                    duration: basicDraft.duration.trim() || null,
                    airline: basicDraft.airline.trim() || null,
                    travelScope: basicDraft.travelScope || null,
                    listingKind: basicDraft.listingKind || null,
                  }),
                })
                const text = await res.text()
                let updated: Product | null = null
                try {
                  updated = text ? (JSON.parse(text) as Product) : null
                } catch {
                  // ignore
                }
                if (res.ok && updated) setProduct(updated)
              } finally {
                setSavingBasic(false)
              }
            }}
            className="mt-3 rounded-lg bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
          >
            {savingBasic ? '저장 중…' : '기본 정보 저장'}
          </button>
        </section>

        <section id="ops-benefit" className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-bt-meta">혜택 요약 (가격·혜택 카피)</h2>
          <p className="mb-2 text-[11px] text-bt-subtle">
            상세 상단 혜택 문구 등에 쓰이는 요약입니다. 사용자 취소선 금액(SSOT)과는 별개입니다.
          </p>
          <textarea
            value={benefitDraft}
            onChange={(e) => setBenefitDraft(e.target.value)}
            rows={4}
            className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
            placeholder="혜택 요약"
          />
          <button
            type="button"
            disabled={savingBenefit || !id}
            onClick={async () => {
              if (!id) return
              setSavingBenefit(true)
              try {
                const res = await fetch(`/api/admin/products/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ benefitSummary: benefitDraft.trim() || null }),
                })
                const text = await res.text()
                let updated: Product | null = null
                try {
                  updated = text ? (JSON.parse(text) as Product) : null
                } catch {
                  // ignore
                }
                if (res.ok && updated) setProduct(updated)
              } finally {
                setSavingBenefit(false)
              }
            }}
            className="mt-3 rounded-lg bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg disabled:opacity-50"
          >
            {savingBenefit ? '저장 중…' : '혜택 요약 저장'}
          </button>
        </section>

        <section id="ops-flight" className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-bt-meta">관리자 확정 항공 (flightAdminJson)</h2>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => {
                  setFlightManualDraft(draftFromFlightManualCorrection(product?.flightManualCorrection))
                  setFlightManualPanelOpen(true)
                }}
                className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-900/50"
              >
                항공 편집
              </button>
            ) : null}
          </div>
          {isEditMode && flightManualContext ? (
            <div className="mb-3 rounded border border-bt-border-strong bg-bt-title/70 p-3 text-[11px] leading-relaxed">
              <p className="font-semibold text-bt-inverse">항공 본문 구조화 진단</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-sky-200">
                  status {flightManualContext.flightStatus ?? '—'}
                </span>
                <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-indigo-200">
                  exposure {flightManualContext.exposurePolicy ?? '—'}
                </span>
                <span className="rounded bg-slate-500/20 px-2 py-0.5 text-slate-200">
                  가는편 review {flightManualContext.fc?.outbound?.reviewState ?? '—'}
                </span>
                <span className="rounded bg-slate-500/20 px-2 py-0.5 text-slate-200">
                  오는편 review {flightManualContext.fc?.inbound?.reviewState ?? '—'}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-bt-subtle">가는편 auto / final</p>
                  <ul className="mt-1 space-y-0.5 text-bt-meta">
                    <li>
                      편명: <span className="text-bt-subtle">auto</span> {flightManualContext.auto.outbound.flightNo ?? '—'}{' '}
                      <span className="text-bt-subtle">· final</span>{' '}
                      {flightManualContext.fc?.outbound?.final?.flightNo ?? '—'}
                    </li>
                    <li>
                      공항: <span className="text-bt-subtle">auto</span>{' '}
                      {flightManualContext.auto.outbound.departureAirport ?? '—'} →{' '}
                      {flightManualContext.auto.outbound.arrivalAirport ?? '—'}{' '}
                      <span className="text-bt-subtle">· final</span>{' '}
                      {flightManualContext.fc?.outbound?.final?.departureAirport ?? '—'} →{' '}
                      {flightManualContext.fc?.outbound?.final?.arrivalAirport ?? '—'}
                    </li>
                    <li>
                      일시: <span className="text-bt-subtle">auto</span>{' '}
                      {flightManualContext.auto.outbound.departureDate ?? '—'} {flightManualContext.auto.outbound.departureTime ?? '—'} →{' '}
                      {flightManualContext.auto.outbound.arrivalDate ?? '—'} {flightManualContext.auto.outbound.arrivalTime ?? '—'}{' '}
                      <span className="text-bt-subtle">· final</span> (모달 참고)
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-bt-subtle">오는편 auto / final</p>
                  <ul className="mt-1 space-y-0.5 text-bt-meta">
                    <li>
                      편명: <span className="text-bt-subtle">auto</span> {flightManualContext.auto.inbound.flightNo ?? '—'}{' '}
                      <span className="text-bt-subtle">· final</span>{' '}
                      {flightManualContext.fc?.inbound?.final?.flightNo ?? '—'}
                    </li>
                    <li>
                      공항: <span className="text-bt-subtle">auto</span>{' '}
                      {flightManualContext.auto.inbound.departureAirport ?? '—'} →{' '}
                      {flightManualContext.auto.inbound.arrivalAirport ?? '—'}{' '}
                      <span className="text-bt-subtle">· final</span>{' '}
                      {flightManualContext.fc?.inbound?.final?.departureAirport ?? '—'} →{' '}
                      {flightManualContext.fc?.inbound?.final?.arrivalAirport ?? '—'}
                    </li>
                    <li>
                      일시: <span className="text-bt-subtle">auto</span>{' '}
                      {flightManualContext.auto.inbound.departureDate ?? '—'} {flightManualContext.auto.inbound.departureTime ?? '—'} →{' '}
                      {flightManualContext.auto.inbound.arrivalDate ?? '—'} {flightManualContext.auto.inbound.arrivalTime ?? '—'}{' '}
                      <span className="text-bt-subtle">· final</span> (모달 참고)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
          <p className="mb-2 text-[11px] text-bt-subtle">
            유효한 JSON만 저장됩니다. 공급사 스크랩 행과 별도로, 확정 항공 표기에 사용합니다. (
            <code className="text-[10px]">lib/admin-flight-profile.ts</code> 참고)
          </p>
          <textarea
            value={flightAdminDraft}
            onChange={(e) => setFlightAdminDraft(e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 font-mono text-xs text-bt-inverse"
            placeholder='{"outboundFlightNo":"…"}'
          />
          <button
            type="button"
            disabled={savingFlightAdmin || !id}
            onClick={async () => {
              if (!id) return
              setSavingFlightAdmin(true)
              try {
                const res = await fetch(`/api/admin/products/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    flightAdminJson: flightAdminDraft.trim() || null,
                  }),
                })
                const text = await res.text()
                let updated: Product | null = null
                try {
                  updated = text ? (JSON.parse(text) as Product) : null
                } catch {
                  // ignore
                }
                if (res.ok && updated) setProduct(updated)
                else if (!res.ok) {
                  try {
                    const err = JSON.parse(text) as { error?: string }
                    alert(err.error ?? '저장 실패')
                  } catch {
                    alert('저장 실패')
                  }
                }
              } finally {
                setSavingFlightAdmin(false)
              }
            }}
            className="mt-3 rounded-lg bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg disabled:opacity-50"
          >
            {savingFlightAdmin ? '저장 중…' : '항공 JSON 저장'}
          </button>

          {flightManualPanelOpen && isEditMode && product ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setFlightManualPanelOpen(false)
              }}
            >
              <div
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-bt-border-strong bg-bt-title p-4 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-bt-inverse">항공 최종(final) 수동 입력</h3>
                  <button
                    type="button"
                    className="text-bt-subtle hover:text-bt-inverse"
                    onClick={() => setFlightManualPanelOpen(false)}
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                <p className="mb-3 text-[11px] text-bt-subtle">
                  값이 하나라도 들어간 편은 공개 화면에서 <strong className="text-bt-inverse">final만</strong>으로 조합됩니다 (자동 본문·출발행 문자열과
                  섞지 않음). 비우고 저장하면 해당 편은 다시 자동 경로를 씁니다.
                </p>
                {(['outbound', 'inbound'] as const).map((leg) => {
                  const isOut = leg === 'outbound'
                  const label = isOut ? '가는편' : '오는편'
                  const draft = isOut ? flightManualDraft.outbound : flightManualDraft.inbound
                  const auto = isOut ? flightManualContext?.auto.outbound : flightManualContext?.auto.inbound
                  const setDraft = (patch: Partial<FlightManualFormLegDraft>) => {
                    setFlightManualDraft((prev) =>
                      isOut ? { ...prev, outbound: { ...prev.outbound, ...patch } } : { ...prev, inbound: { ...prev.inbound, ...patch } }
                    )
                  }
                  const row = (
                    k: keyof FlightManualFormLegDraft,
                    sub: string,
                    ph?: string | null
                  ) => (
                    <label key={k} className="block text-[10px] sm:col-span-1">
                      <span className="text-bt-subtle">
                        auto {sub}
                      </span>{' '}
                      <span className="text-bt-meta">{(auto?.[k] as string | null | undefined)?.trim() || '—'}</span>
                      <span className="mt-0.5 block font-medium text-bt-subtle">최종 {sub}</span>
                      <input
                        value={draft[k]}
                        onChange={(e) => setDraft({ [k]: e.target.value } as Partial<FlightManualFormLegDraft>)}
                        placeholder={ph ?? (auto?.[k] as string | undefined) ?? ''}
                        className="mt-0.5 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-inverse"
                      />
                    </label>
                  )
                  return (
                    <div key={leg} className="mb-4 rounded border border-bt-border-strong bg-bt-title/80 p-3">
                      <p className="mb-2 text-xs font-semibold text-bt-inverse">{label}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {row('airline', '항공사')}
                        {row('flightNo', '편명')}
                        {row('departureAirport', '출발지')}
                        {row('departureDate', '출발 연월일', '2026.07.07(화)')}
                        {row('departureTime', '출발 시간', '19:20')}
                        {row('arrivalAirport', '도착지')}
                        {row('arrivalDate', '도착 연월일')}
                        {row('arrivalTime', '도착 시간')}
                      </div>
                    </div>
                  )
                })}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingFlightManual || !id}
                    onClick={async () => {
                      if (!id) return
                      setSavingFlightManual(true)
                      try {
                        const payload = buildFlightManualCorrectionForSave(
                          flightManualDraft,
                          product.rawMeta ?? null,
                          brandForInternal,
                          originForInternal
                        )
                        const res = await fetch(`/api/admin/products/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ flightManualCorrection: payload }),
                        })
                        const text = await res.text()
                        let updated: Product | null = null
                        try {
                          updated = text ? (JSON.parse(text) as Product) : null
                        } catch {
                          // ignore
                        }
                        if (res.ok && updated) {
                          setProduct(updated)
                          setFlightManualPanelOpen(false)
                        } else if (!res.ok) {
                          try {
                            const err = JSON.parse(text) as { error?: string }
                            alert(err.error ?? '저장 실패')
                          } catch {
                            alert('저장 실패')
                          }
                        }
                      } finally {
                        setSavingFlightManual(false)
                      }
                    }}
                    className="rounded-lg bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg disabled:opacity-50"
                  >
                    {savingFlightManual ? '저장 중…' : '수동 보정 저장'}
                  </button>
                  <button
                    type="button"
                    disabled={savingFlightManual || !id}
                    onClick={async () => {
                      if (!id) return
                      setFlightManualDraft(emptyFlightManualFormDraft())
                      setSavingFlightManual(true)
                      try {
                        const res = await fetch(`/api/admin/products/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ flightManualCorrection: null }),
                        })
                        const text = await res.text()
                        let updated: Product | null = null
                        try {
                          updated = text ? (JSON.parse(text) as Product) : null
                        } catch {
                          // ignore
                        }
                        if (res.ok && updated) {
                          setProduct(updated)
                          setFlightManualPanelOpen(false)
                        }
                      } finally {
                        setSavingFlightManual(false)
                      }
                    }}
                    className="rounded-lg border border-bt-border-strong px-4 py-2 text-xs font-semibold text-bt-meta"
                  >
                    수동값 비우기
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlightManualPanelOpen(false)}
                    className="rounded-lg border border-bt-border-strong px-4 py-2 text-xs font-semibold text-bt-meta"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section id="ops-memo" className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-bt-meta">상담 메모 (counselingNotes JSON)</h2>
          <p className="mb-2 text-[11px] text-bt-subtle">
            MUST/TIP 등 구조화 메모. JSON 문자열 그대로 저장합니다.
          </p>
          <textarea
            value={counselingDraft}
            onChange={(e) => setCounselingDraft(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 font-mono text-xs text-bt-inverse"
          />
          <button
            type="button"
            disabled={savingCounseling || !id}
            onClick={async () => {
              if (!id) return
              setSavingCounseling(true)
              try {
                const res = await fetch(`/api/admin/products/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    counselingNotes: counselingDraft.trim() || null,
                  }),
                })
                const text = await res.text()
                let updated: Product | null = null
                try {
                  updated = text ? (JSON.parse(text) as Product) : null
                } catch {
                  // ignore
                }
                if (res.ok && updated) setProduct(updated)
              } finally {
                setSavingCounseling(false)
              }
            }}
            className="mt-3 rounded-lg bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg disabled:opacity-50"
          >
            {savingCounseling ? '저장 중…' : '상담 메모 저장'}
          </button>
        </section>

        {product.productType?.toLowerCase() === 'airtel' && airtelHotelInfo && (
          <section className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-bt-meta">에어텔 호텔 정보</h2>
            <div className="grid gap-2 sm:grid-cols-2 text-sm text-bt-inverse/90">
              {Object.entries(airtelHotelInfo).map(([k, v]) => (
                <p key={k}>
                  <span className="text-bt-subtle">{k}</span>: {v}
                </p>
              ))}
            </div>
          </section>
        )}
        <section id="ops-optional" className="mb-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-bt-meta">현지옵션 관리</h2>
            <button
              type="button"
              onClick={() =>
                setOptionalToursDraft((prev) => [
                  ...prev,
                  {
                    id: `tour-${Date.now()}`,
                    name: '',
                    priceText: '',
                    priceValue: '',
                    currency: '',
                    description: '',
                    bookingType: 'unknown',
                    sortOrder: prev.length,
                    rawText: '',
                    autoExtracted: false,
                  },
                ])
              }
              className="rounded border border-bt-border-strong px-3 py-1 text-xs text-bt-meta hover:bg-bt-title"
            >
              항목 추가
            </button>
          </div>
          <p className="mb-3 text-xs text-bt-subtle">
            공급사 원문에서 추출된 현지옵션 정보를 확인하고 수정할 수 있습니다. (SSOT: optionalToursStructured)
          </p>
          {optionalToursDirty ? (
            <p className="mb-3 text-xs font-semibold text-amber-300">저장되지 않은 변경이 있습니다.</p>
          ) : null}
          {optionalToursDraft.length === 0 ? (
            <p className="text-xs text-bt-subtle">등록된 현지옵션 정보가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {optionalToursDraft.map((tour, idx) => (
                <div key={tour.id} className="rounded border border-bt-border-strong p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-bt-meta">항목 {idx + 1}</p>
                    <div className="flex items-center gap-2">
                      {tour.autoExtracted ? (
                        <span className="inline-flex rounded border border-emerald-300 bg-emerald-50/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                          자동 추출
                        </span>
                      ) : (
                        <span className="inline-flex rounded border border-sky-300 bg-sky-50/10 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                          수동 수정
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setOptionalToursDraft((prev) => {
                            if (idx === 0) return prev
                            const next = [...prev]
                            const tmp = next[idx - 1]
                            next[idx - 1] = next[idx]
                            next[idx] = tmp
                            return next
                          })
                        }
                        className="text-xs text-bt-subtle hover:text-bt-meta"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOptionalToursDraft((prev) => {
                            if (idx >= prev.length - 1) return prev
                            const next = [...prev]
                            const tmp = next[idx + 1]
                            next[idx + 1] = next[idx]
                            next[idx] = tmp
                            return next
                          })
                        }
                        className="text-xs text-bt-subtle hover:text-bt-meta"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setOptionalToursDraft((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-bt-danger"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input value={tour.name} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} placeholder="현지옵션명" className="rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta" />
                    <input value={tour.priceText} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, priceText: e.target.value } : x)))} placeholder="가격표기 (예: 1인 50유로)" className="rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta" />
                    <input value={tour.priceValue} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, priceValue: e.target.value } : x)))} placeholder="숫자 가격(optional)" className="rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta" />
                    <input value={tour.currency} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, currency: e.target.value } : x)))} placeholder="통화 (EUR/USD)" className="rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta" />
                    <select value={tour.bookingType} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, bookingType: e.target.value as OptionalTourDraft['bookingType'] } : x)))} className="rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta">
                      <option value="unknown">미확인</option>
                      <option value="onsite">현지 신청</option>
                      <option value="pre">사전 신청 권장</option>
                      <option value="inquire">문의 후 확인</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-bt-meta">
                      <input type="checkbox" checked={tour.autoExtracted} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, autoExtracted: e.target.checked } : x)))} />
                      자동추출
                    </label>
                  </div>
                  <textarea value={tour.description} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} placeholder="사용자 노출 설명 문구 (짧고 명확하게)" rows={2} className="mt-2 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta" />
                  <textarea value={tour.rawText} onChange={(e) => setOptionalToursDraft((prev) => prev.map((x, i) => (i === idx ? { ...x, rawText: e.target.value } : x)))} placeholder="원문 문구(rawText) - 참고용" rows={2} className="mt-2 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-1 text-xs text-bt-meta" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void saveOptionalTours()}
              disabled={savingOptionalTours}
              className="rounded bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg disabled:opacity-60"
            >
              {savingOptionalTours ? '저장 중…' : '현지옵션 저장'}
            </button>
          </div>
        </section>

        {/* 대표 이미지 / 출처: 메타 카드 아래, 보강 대상 블록 위 */}
        <section id="admin-product-hero-image" className="mb-6 scroll-mt-24 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-bt-meta">대표 이미지 · 출처</h2>
          {primaryImageMessage && (
            <p
              className={`mb-3 text-xs ${
                primaryImageMessage.startsWith('업로드 실패') || primaryImageMessage.includes('실패')
                  ? 'text-bt-danger'
                  : 'text-bt-badge-domestic-text'
              }`}
            >
              {primaryImageMessage}
            </p>
          )}
          {product.bgImageUrl ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0 sm:w-48">
                <PrimaryImagePreview url={product.bgImageUrl} />
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <p>
                  <span className="text-bt-subtle">출처</span>{' '}
                  <span className="inline-flex rounded bg-bt-title px-2 py-0.5 font-medium text-bt-inverse">
                    {adminProductBgImageAttributionLine(product.bgImageSource, product.bgImageIsGenerated)}
                  </span>
                </p>
                <p>
                  <span className="text-bt-subtle">AI 생성 플래그</span>{' '}
                  <span className="text-bt-inverse">{product.bgImageIsGenerated ? '예' : '아니오'}</span>
                </p>
                {product.bgImagePhotographer && (
                  <p>
                    <span className="text-bt-subtle">작가</span> <span className="text-bt-inverse">{product.bgImagePhotographer}</span>
                  </p>
                )}
                {product.bgImageSourceUrl && (
                  <p>
                    <span className="text-bt-subtle">원본</span>{' '}
                    <a
                      href={product.bgImageSourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-bt-inverse/90 hover:text-bt-inverse hover:underline"
                    >
                      링크 ↗
                    </a>
                  </p>
                )}
                {product.bgImageExternalId && (
                  <p>
                    <span className="text-bt-subtle">외부 ID</span> <span className="text-bt-meta">{product.bgImageExternalId}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-bt-border-strong bg-bt-title/50 p-6 text-center">
              <p className="font-medium text-bt-meta">대표 이미지 없음</p>
              <p className="mt-1 text-xs text-bt-subtle">아래에서 파일을 올리거나 이미지 보강으로 채울 수 있습니다.</p>
            </div>
          )}
          <div className="mt-4 space-y-3 border-t border-bt-border-strong pt-4">
            <label className="block text-xs">
              <span className="text-bt-subtle">이미지 출처</span>
              <select
                className="mt-1 w-full max-w-md rounded border border-bt-border-strong bg-bt-title px-2 py-2 text-sm text-bt-inverse"
                value={manualHeroUploadPreset}
                disabled={primaryImageUploading}
                onChange={(e) => setManualHeroUploadPreset(e.target.value as AdminManualPrimaryHeroUploadPreset)}
              >
                {ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {manualHeroUploadPreset === 'other' ? (
              <label className="block text-xs">
                <span className="text-bt-subtle">기타 출처 설명</span>
                <input
                  className="mt-1 w-full max-w-md rounded border border-bt-border-strong bg-bt-title px-2 py-2 text-sm text-bt-inverse"
                  value={manualHeroUploadOtherNote}
                  disabled={primaryImageUploading}
                  onChange={(e) => setManualHeroUploadOtherNote(e.target.value)}
                  placeholder="표기용 짧은 이름"
                />
              </label>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-xs font-medium text-bt-body hover:bg-bt-surface-soft">
                {primaryImageUploading ? '업로드 중…' : '대표 이미지 파일 업로드'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={primaryImageUploading}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0] ?? null
                    void handlePrimaryImageUpload(f)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
              <span className="text-[11px] text-bt-muted">사진풀에 저장한 뒤 이 상품 대표 이미지로 연결됩니다. 파일당 최대 30MB.</span>
            </div>
          </div>

          {scheduleEntries.some((e) => Boolean(e.imageUrl?.trim())) ? (
            <div className="mt-4 rounded-lg border border-bt-border-strong bg-bt-surface-soft/80 p-4 text-xs text-bt-body">
              <p className="font-medium text-bt-title">일정 이미지에서 대표로 선택</p>
              <p className="mt-1 text-[11px] text-bt-muted">
                공항·이동 중심 1일차 대신, 해당 일차 사진을 그대로 대표 커버로 지정합니다.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {scheduleEntries
                  .filter((e) => e.imageUrl?.trim())
                  .map((e) => (
                    <button
                      key={`hero-pick-day-${e.day}`}
                      type="button"
                      disabled={heroReselectBusy || primaryImageUploading}
                      onClick={() => void pickScheduleEntryAsHero(e)}
                      className="flex flex-col items-center gap-1 rounded border border-bt-border-strong bg-bt-title p-2 hover:bg-bt-surface-soft disabled:opacity-50"
                    >
                      <img src={e.imageUrl!.trim()} alt="" className="h-14 w-24 rounded object-cover" />
                      <span className="text-[11px] text-bt-muted">{e.day}일차</span>
                    </button>
                  ))}
              </div>
              <button
                type="button"
                disabled={heroReselectBusy || primaryImageUploading || !id}
                onClick={() => void runTravelProcessImagesReselect()}
                className="mt-3 rounded border border-bt-border-strong bg-bt-surface px-3 py-2 text-xs font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
              >
                {heroReselectBusy ? '재선정 중…' : '키워드 기반 일정·대표 재선정'}
              </button>
              <p className="mt-1 text-[10px] text-bt-muted">
                기존 이미지 보강 API(`/api/travel/process-images`)를 호출합니다. 수십 초~1분 걸릴 수 있습니다.
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border border-bt-border-strong bg-bt-surface-soft/80 p-4 text-xs text-bt-body">
            <p className="font-medium text-bt-title">갤러리 등 추가 이미지 (파일 + 출처)</p>
            <p className="mt-1 text-bt-muted">
              위와 동일한 출처 선택으로 이 상품에 추가 이미지를 올립니다. 상품명·공급사 등은 자동으로 채워집니다.{' '}
              <Link
                href={id ? `/admin/image-assets-upload?productId=${encodeURIComponent(id)}` : '/admin/image-assets-upload'}
                className="font-medium text-bt-brand-blue underline"
              >
                상품 이미지 업로드 열기
              </Link>
            </p>
          </div>

          {product.bgImageUrl ? (
            <div className="mt-4 space-y-3 rounded-lg border border-bt-border-strong bg-bt-title/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-bt-meta">대표 이미지 출처 편집</h3>
              <p className="text-[11px] text-bt-muted">
                URL은 그대로 두고, 아래만 바꿉니다. iStock이면 출처를 <strong className="text-bt-body">iStock</strong>으로 맞추고 원본
                페이지 링크·작가명을 넣어 주세요.
              </p>
              {heroMetaMessage && (
                <p
                  className={`text-xs ${
                    heroMetaMessage.includes('실패') || heroMetaMessage === '저장 실패' ? 'text-bt-danger' : 'text-bt-badge-domestic-text'
                  }`}
                >
                  {heroMetaMessage}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs sm:col-span-2">
                  <span className="text-bt-subtle">출처 유형</span>
                  <select
                    className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-2 text-sm text-bt-inverse"
                    value={heroMetaDraft.source}
                    onChange={(e) => setHeroMetaDraft((d) => ({ ...d, source: e.target.value }))}
                  >
                    {HERO_SOURCE_SELECT.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="text-bt-subtle">작가 / 크레딧명 (선택)</span>
                  <input
                    className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-2 text-sm text-bt-inverse"
                    value={heroMetaDraft.photographer}
                    onChange={(e) => setHeroMetaDraft((d) => ({ ...d, photographer: e.target.value }))}
                    placeholder="iStock 기여자명 등"
                  />
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="text-bt-subtle">원본 링크 (선택)</span>
                  <input
                    className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-2 text-sm text-bt-inverse"
                    value={heroMetaDraft.sourceUrl}
                    onChange={(e) => setHeroMetaDraft((d) => ({ ...d, sourceUrl: e.target.value }))}
                    placeholder="https://www.istockphoto.com/..."
                  />
                </label>
                <label className="block text-xs sm:col-span-2">
                  <span className="text-bt-subtle">외부 ID (선택)</span>
                  <input
                    className="mt-1 w-full rounded border border-bt-border-strong bg-bt-title px-2 py-2 text-sm text-bt-inverse"
                    value={heroMetaDraft.externalId}
                    onChange={(e) => setHeroMetaDraft((d) => ({ ...d, externalId: e.target.value }))}
                    placeholder="에셋 ID 등"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveHeroImageMeta()}
                disabled={savingHeroMeta}
                className="rounded bg-bt-cta-primary px-4 py-2 text-xs font-semibold text-bt-cta-primary-fg disabled:opacity-60"
              >
                {savingHeroMeta ? '저장 중…' : '출처만 저장'}
              </button>
            </div>
          ) : null}
        </section>

        {/* 이미지 보강 대상 */}
        {product.needsImageReview && (
          <div className="mb-6 rounded-xl border border-bt-warning bg-bt-badge-freeform/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-bt-badge-freeform-text">이미지 보강 대상</p>
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-bt-body">
                  목록의 「보강 보내기」는 <strong className="text-bt-title">표시용 플래그</strong>만 켭니다. 자동으로 사진을 고르지 않습니다.{' '}
                  <a href="#admin-product-hero-image" className="font-medium text-bt-brand-blue underline">
                    위쪽 「대표 이미지 · 출처」
                  </a>
                  에서 파일을 업로드해 교체한 뒤, 아래 「보강 완료」를 누르세요.
                </p>
                {product.imageReviewRequestedAt && (
                  <p className="mt-0.5 text-xs text-bt-warning">
                    요청일: {new Date(product.imageReviewRequestedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                )}
                {imageReviewMessage && (
                  <p className={`mt-1 text-sm ${imageReviewMessage.startsWith('실패') || imageReviewMessage.includes('오류') ? 'text-bt-danger' : 'text-bt-badge-domestic-text'}`}>
                    {imageReviewMessage}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!id) return
                    if (!product.bgImageUrl?.trim()) {
                      setImageReviewMessage(
                        '대표 이미지가 없으면 보강 완료할 수 없습니다. 먼저 업로드·선택 후 저장하세요.'
                      )
                      return
                    }
                    setImageReviewMessage(null)
                    setImageReviewSaving(true)
                    try {
                      const res = await fetch(`/api/admin/products/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ needsImageReview: false }),
                      })
                      const text = await res.text()
                      let updated: Product | null = null
                      try {
                        updated = text ? (JSON.parse(text) as Product) : null
                      } catch {
                        // ignore
                      }
                      if (res.ok && updated) {
                        setProduct(updated)
                        setImageReviewMessage('보강 완료 처리되었습니다.')
                      } else {
                        const err = text ? (JSON.parse(text) as { error?: string })?.error : '실패'
                        setImageReviewMessage(err ?? '저장 실패')
                      }
                    } catch (e) {
                      setImageReviewMessage(e instanceof Error ? e.message : '요청 실패')
                    } finally {
                      setImageReviewSaving(false)
                    }
                  }}
                  disabled={imageReviewSaving}
                  className="rounded-lg bg-bt-cta-accent px-4 py-2 text-sm font-medium text-bt-cta-accent-text hover:brightness-95 disabled:opacity-50"
                >
                  {imageReviewSaving ? '처리 중…' : '보강 완료'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!id) return
                    setImageReviewMessage(null)
                    setImageReviewSaving(true)
                    try {
                      const res = await fetch(`/api/admin/products/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ needsImageReview: false }),
                      })
                      const text = await res.text()
                      let updated: Product | null = null
                      try {
                        updated = text ? (JSON.parse(text) as Product) : null
                      } catch {
                        // ignore
                      }
                      if (res.ok && updated) {
                        setProduct(updated)
                        setImageReviewMessage('보강 대상에서 해제되었습니다.')
                      } else {
                        const err = text ? (JSON.parse(text) as { error?: string })?.error : '실패'
                        setImageReviewMessage(err ?? '저장 실패')
                      }
                    } catch (e) {
                      setImageReviewMessage(e instanceof Error ? e.message : '요청 실패')
                    } finally {
                      setImageReviewSaving(false)
                    }
                  }}
                  disabled={imageReviewSaving}
                  className="rounded-lg border border-bt-warning bg-transparent px-4 py-2 text-sm font-medium text-bt-badge-freeform-text hover:bg-bt-badge-freeform/30 disabled:opacity-50"
                >
                  보강 대상 해제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* schedule JSON → 가변 리스트 UI */}
        <section className="mb-8 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-bt-meta">일차별 일정 (schedule)</h2>
            {scheduleDirty && (
              <button
                type="button"
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
              >
                {savingSchedule ? '저장 중…' : '한 번에 저장'}
              </button>
            )}
          </div>
          <p className="mb-4 text-xs text-bt-subtle">
            imageKeyword 수정은 임시 저장(상태 유지) 후 위 [한 번에 저장]으로 DB에 반영됩니다.
          </p>
          {scheduleEntries.length === 0 ? (
            <div className="py-6 text-center">
              <p className="mb-3 text-bt-subtle">일정 데이터가 없습니다.</p>
              {(product?.itineraries?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={generateScheduleFromItineraries}
                  disabled={generatingSchedule}
                  className="rounded-lg bg-bt-muted px-4 py-2 text-sm font-medium text-bt-inverse hover:bg-bt-meta disabled:opacity-50"
                >
                  {generatingSchedule ? '생성 중…' : 'Itinerary에서 일정 생성'}
                </button>
              ) : (
                <p className="text-xs text-bt-muted">Itinerary 데이터가 있으면 여기서 일정을 생성할 수 있습니다.</p>
              )}
            </div>
          ) : (
            <ul className="space-y-6">
              {scheduleEntries.map((entry, index) => (
                <li key={`${entry.day}-${index}`} className="rounded-lg border border-bt-border-strong bg-bt-title/50 p-4">
                  <div className="mb-3 font-medium text-bt-inverse">Day {entry.day}</div>
                  <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                    <div>
                      <ScheduleImage url={entry.imageUrl} alt={`Day ${entry.day}`} />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs text-bt-subtle">imageKeyword</label>
                        <input
                          type="text"
                          value={entry.imageKeyword ?? ''}
                          onChange={(e) => updateScheduleEntry(index, 'imageKeyword', e.target.value)}
                          placeholder="검색 키워드"
                          className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse placeholder:text-bt-subtle"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-bt-subtle">title</label>
                        <input
                          type="text"
                          value={entry.title ?? ''}
                          onChange={(e) => updateScheduleEntry(index, 'title', e.target.value)}
                          className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-bt-subtle">description</label>
                        <textarea
                          value={entry.description ?? ''}
                          onChange={(e) => updateScheduleEntry(index, 'description', e.target.value)}
                          rows={2}
                          placeholder="일정 설명"
                          className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse placeholder:text-bt-subtle"
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 원문 일정표 (ItineraryDay) — 읽기 전용 */}
        <section className="mb-8 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-bt-meta">원문 일정표 (ItineraryDay)</h2>
          {itineraryDays === null ? (
            <p className="text-sm text-bt-subtle">로딩 중…</p>
          ) : itineraryDays.length === 0 ? (
            <p className="text-sm text-bt-subtle">원문 일정표 데이터가 없습니다.</p>
          ) : (
            <ul className="space-y-4">
              {itineraryDays.map((row) => (
                <li key={row.id} className="rounded-lg border border-bt-border-strong bg-bt-title/50 p-4">
                  <div className="mb-2 font-medium text-bt-inverse">Day {row.day}</div>
                  <div className="space-y-1 text-sm text-bt-inverse/90">
                    {row.dateText != null && row.dateText !== '' && (
                      <p><span className="text-bt-subtle">날짜 표기: </span>{row.dateText}</p>
                    )}
                    {row.city != null && row.city !== '' && (
                      <p><span className="text-bt-subtle">도시/지역: </span>{row.city}</p>
                    )}
                    {row.summaryTextRaw != null && row.summaryTextRaw !== '' && (
                      <p className="whitespace-pre-wrap"><span className="text-bt-subtle">요약: </span>{row.summaryTextRaw}</p>
                    )}
                    {row.poiNamesRaw != null && row.poiNamesRaw !== '' && (
                      <p><span className="text-bt-subtle">방문지: </span>{row.poiNamesRaw}</p>
                    )}
                    {row.meals != null && row.meals !== '' && (
                      <p><span className="text-bt-subtle">식사: </span>{row.meals}</p>
                    )}
                    {row.accommodation != null && row.accommodation !== '' && (
                      <p><span className="text-bt-subtle">숙박: </span>{row.accommodation}</p>
                    )}
                    {row.transport != null && row.transport !== '' && (
                      <p><span className="text-bt-subtle">교통: </span>{row.transport}</p>
                    )}
                    {row.notes != null && row.notes !== '' && (
                      <p className="whitespace-pre-wrap"><span className="text-bt-subtle">유의사항: </span>{row.notes}</p>
                    )}
                    {row.summaryTextRaw == null && row.poiNamesRaw == null && row.city == null && row.dateText == null && row.meals == null && row.accommodation == null && row.transport == null && row.notes == null && (
                      <p className="text-bt-subtle">—</p>
                    )}
                  </div>
                  {row.rawBlock != null && row.rawBlock !== '' && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-bt-subtle hover:text-bt-meta">원문 블록 보기</summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded border border-bt-border-strong bg-bt-title p-3 text-xs text-bt-meta whitespace-pre-wrap break-words">
                        {row.rawBlock}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 출발일/가격/상태 (ProductDeparture) — 읽기 전용 */}
        <section className="mb-8 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-bt-meta">
            출발일/가격/상태 (ProductDeparture)
          </h2>
          {departures === null ? (
            <p className="text-sm text-bt-subtle">로딩 중…</p>
          ) : departures.length === 0 ? (
            <p className="text-sm text-bt-subtle">출발일 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm text-bt-inverse/90">
                <thead>
                  <tr className="border-b border-bt-border-strong text-left">
                    <th className="py-2 pr-2 font-medium text-bt-meta">출발일</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">성인가</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">아동(베드)</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">아동(노베드)</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">유아</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">상태</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">잔여</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">확정</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">예약가능</th>
                    <th className="py-2 pr-2 font-medium text-bt-meta">최소인원</th>
                    <th className="py-2 font-medium text-bt-meta">동기화</th>
                  </tr>
                </thead>
                <tbody>
                  {departures.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b border-bt-border-strong/70">
                        <td className="py-2 pr-2 text-bt-inverse">
                          {row.departureDate
                            ? new Date(row.departureDate).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {row.adultPrice != null ? row.adultPrice.toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {row.childBedPrice != null ? row.childBedPrice.toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {row.childNoBedPrice != null ? row.childNoBedPrice.toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {row.infantPrice != null ? row.infantPrice.toLocaleString() : '—'}
                        </td>
                        <td
                          className="max-w-[120px] truncate py-2 pr-2 text-bt-meta"
                          title={adminDepartureText(row.statusRaw ?? undefined) || undefined}
                        >
                          {adminDepartureText(row.statusRaw) || '—'}
                        </td>
                        <td
                          className="max-w-[120px] truncate py-2 pr-2 text-bt-meta"
                          title={adminDepartureText(row.seatsStatusRaw ?? undefined) || undefined}
                        >
                          {adminDepartureText(row.seatsStatusRaw) || '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {row.isConfirmed === true ? '확정' : row.isConfirmed === false ? '아님' : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {row.isBookable === true ? '가능' : row.isBookable === false ? '불가' : '—'}
                        </td>
                        <td className="py-2 pr-2">{row.minPax != null ? row.minPax : '—'}</td>
                        <td className="py-2">
                          {row.syncedAt
                            ? new Date(row.syncedAt).toLocaleString('ko-KR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                      </tr>
                      {hasFlightOrMeeting(row) && (
                        <tr className="border-b border-bt-border-strong bg-bt-title/80">
                          <td colSpan={11} className="px-2 py-3 align-top text-xs text-bt-meta">
                            <div className="space-y-2">
                              <div>
                                <span className="font-medium text-bt-subtle">항공 </span>
                                {row.carrierName && (
                                  <span className="text-bt-inverse/90">{adminDepartureText(row.carrierName)}</span>
                                )}
                                <div className="mt-1 whitespace-pre-wrap break-words">
                                  가는편:{' '}
                                  {[row.outboundDepartureAirport, row.outboundArrivalAirport].filter(Boolean).join(' → ') ||
                                    '—'}{' '}
                                  / {row.outboundFlightNo ?? '—'} / {formatDepartureDt(row.outboundDepartureAt)} →{' '}
                                  {formatDepartureDt(row.outboundArrivalAt)}
                                </div>
                                <div className="mt-1 whitespace-pre-wrap break-words">
                                  오는편:{' '}
                                  {[row.inboundDepartureAirport, row.inboundArrivalAirport].filter(Boolean).join(' → ') ||
                                    '—'}{' '}
                                  / {row.inboundFlightNo ?? '—'} / {formatDepartureDt(row.inboundDepartureAt)} →{' '}
                                  {formatDepartureDt(row.inboundArrivalAt)}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium text-bt-subtle">미팅 </span>
                                {row.meetingInfoRaw && (
                                  <p
                                    className="text-bt-inverse/90"
                                    title={adminDepartureText(row.meetingInfoRaw)}
                                  >
                                    {(() => {
                                      const t = adminDepartureText(row.meetingInfoRaw)
                                      return t.length > 160 ? `${t.slice(0, 160)}…` : t
                                    })()}
                                  </p>
                                )}
                                {row.meetingPointRaw && (
                                  <p className="mt-0.5">
                                    <span className="text-bt-subtle">장소: </span>
                                    {adminDepartureText(row.meetingPointRaw)}
                                  </p>
                                )}
                                {row.meetingTerminalRaw && (
                                  <p className="mt-0.5">
                                    <span className="text-bt-subtle">터미널: </span>
                                    {adminDepartureText(row.meetingTerminalRaw)}
                                  </p>
                                )}
                                {row.meetingGuideNoticeRaw && (
                                  <p className="mt-0.5 whitespace-pre-wrap break-words">
                                    <span className="text-bt-subtle">가이드 안내: </span>
                                    {adminDepartureText(row.meetingGuideNoticeRaw)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {departures != null && departures.length > 0 && departures.some((r) => r.localPriceText) && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-bt-subtle hover:text-bt-meta">현지 가격 원문</summary>
              <ul className="mt-2 space-y-1 text-xs text-bt-meta">
                {departures.map(
                  (r) =>
                    r.localPriceText && (
                      <li key={r.id}>
                        {new Date(r.departureDate).toLocaleDateString('ko-KR')}: {r.localPriceText}
                      </li>
                    )
                )}
              </ul>
            </details>
          )}
        </section>

        <section className="mb-8 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-bt-meta">포함/불포함 (공개 상세)</h2>
          <p className="mb-4 text-xs text-bt-subtle">
            공개 상품 페이지의 <span className="text-bt-inverse/90">포함/불포함사항</span> 탭과 연결됩니다. 호텔 정보는 본문·일정 파이프(
            <code className="text-[10px]">dayHotelPlans</code> 등)로 공개 호텔 탭에 반영되며, 여기서는 더 이상 수동 입력하지 않습니다.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-bt-subtle">포함사항</label>
              <textarea
                value={publicDetailDraft.included}
                onChange={(e) => setPublicDetailDraft((d) => ({ ...d, included: e.target.value }))}
                rows={9}
                className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                placeholder="포함 내용"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-bt-subtle">불포함사항</label>
              <textarea
                value={publicDetailDraft.excluded}
                onChange={(e) => setPublicDetailDraft((d) => ({ ...d, excluded: e.target.value }))}
                rows={9}
                className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                placeholder="불포함 내용"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void savePublicDetailTexts()}
            disabled={savingPublicDetail}
            className="mt-4 rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
          >
            {savingPublicDetail ? '저장 중…' : '포함·불포함 저장'}
          </button>
        </section>

        {/* 상세 설명 텍스트 (정제된) */}
        {(sanitizedIncluded || sanitizedExcluded || sanitizedCritical) && (
          <section className="mb-8 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-bt-meta">상세 설명 (정제)</h2>
            <div className="space-y-4 text-sm text-bt-inverse/90">
              {sanitizedCritical && (
                <div>
                  <span className="font-medium text-bt-warning">불포함 요약: </span>
                  <span className="whitespace-pre-wrap">{sanitizedCritical}</span>
                </div>
              )}
              {sanitizedIncluded && (
                <div>
                  <span className="font-medium text-bt-meta">포함: </span>
                  <span className="whitespace-pre-wrap">{sanitizedIncluded}</span>
                </div>
              )}
              {sanitizedExcluded && (
                <div>
                  <span className="font-medium text-bt-meta">불포함: </span>
                  <span className="whitespace-pre-wrap">{sanitizedExcluded}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 첫 출발일 요금 */}
        {product.prices?.length > 0 && (
          <section id="ops-first-price" className="mb-8 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-bt-meta">첫 출발일 요금</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-bt-subtle">성인</label>
                <input
                  type="number"
                  min={0}
                  value={priceForm.adult}
                  onChange={(e) => setPriceForm((f) => ({ ...f, adult: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-bt-subtle">아동(베드)</label>
                <input
                  type="number"
                  min={0}
                  value={priceForm.childBed}
                  onChange={(e) => setPriceForm((f) => ({ ...f, childBed: e.target.value }))}
                  placeholder="원"
                  className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-bt-subtle">아동(노베드)</label>
                <input
                  type="number"
                  min={0}
                  value={priceForm.childNoBed}
                  onChange={(e) => setPriceForm((f) => ({ ...f, childNoBed: e.target.value }))}
                  placeholder="원"
                  className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-bt-subtle">유아</label>
                <input
                  type="number"
                  min={0}
                  value={priceForm.infant}
                  onChange={(e) => setPriceForm((f) => ({ ...f, infant: e.target.value }))}
                  placeholder="원"
                  className="w-full rounded border border-bt-border-strong bg-bt-title px-3 py-2 text-sm text-bt-inverse"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={savingPrice}
              onClick={async () => {
                setSavingPrice(true)
                try {
                  const res = await fetch(`/api/admin/products/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      firstPriceRow: {
                        priceAdult: priceForm.adult,
                        priceChildWithBed: priceForm.childBed === '' ? null : parseInt(priceForm.childBed, 10),
                        priceChildNoBed: priceForm.childNoBed === '' ? null : parseInt(priceForm.childNoBed, 10),
                        priceInfant: priceForm.infant === '' ? null : parseInt(priceForm.infant, 10),
                      },
                    }),
                  })
                  const text = await res.text()
                  let updated: Product | null = null
                  try {
                    updated = text ? (JSON.parse(text) as Product) : null
                  } catch {
                    // empty or invalid JSON
                  }
                  if (res.ok && updated) setProduct(updated)
                } finally {
                  setSavingPrice(false)
                }
              }}
              className="mt-3 rounded-lg bg-bt-title px-4 py-2 text-sm font-medium text-bt-inverse hover:bg-bt-muted disabled:opacity-50"
            >
              {savingPrice ? '저장 중…' : '요금 저장'}
            </button>
          </section>
        )}

        {/* 가격 캘린더 */}
        {product.prices?.length > 0 && (
          <section className="rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-bt-meta">가격 캘린더</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bt-border-strong text-bt-meta">
                    <th className="px-2 py-2 text-left">날짜</th>
                    <th className="px-2 py-2 text-right">성인</th>
                    <th className="px-2 py-2 text-right">아동/노베드/유아</th>
                  </tr>
                </thead>
                <tbody>
                  {(product.prices ?? []).slice(0, 14).map((row) => (
                    <tr key={row.id} className="border-b border-bt-border-strong">
                      <td className="px-2 py-1.5 text-bt-inverse/90">
                        {typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-bt-inverse">
                        {(row.adult ?? 0).toLocaleString()}원
                      </td>
                      <td className="px-2 py-1.5 text-right text-bt-meta">
                        {[row.childBed, row.childNoBed, row.infant]
                          .filter((v): v is number => v != null)
                          .map((v) => v.toLocaleString())
                          .join(' / ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(product.itineraries?.length ?? 0) > 0 && (
          <section className="mt-6 rounded-xl border border-bt-border-strong bg-bt-title/50 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-bt-meta">일정 (Itinerary)</h2>
            <ul className="space-y-2 text-sm text-bt-inverse/90">
              {(product.itineraries ?? []).map((i) => (
                <li key={i.id}>
                  <span className="font-medium text-bt-inverse">Day {i.day}</span>
                  <pre className="mt-0.5 whitespace-pre-wrap text-bt-meta">{i.description}</pre>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
