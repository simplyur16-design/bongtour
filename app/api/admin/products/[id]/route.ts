import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { adminProductJsonWithPromotionRef } from '@/lib/admin-product-reference-prices'
import {
  getFlightAdminJsonFromRawMeta,
  mergeFlightAdminJsonIntoRawMeta,
  mergeFlightManualCorrectionIntoRawMeta,
} from '@/lib/raw-meta-admin-flight'
import * as flightManualHanatour from '@/lib/flight-manual-correction-hanatour'
import * as flightManualModetour from '@/lib/flight-manual-correction-modetour'
import * as flightManualVerygoodtour from '@/lib/flight-manual-correction-verygoodtour'
import * as flightManualYbtour from '@/lib/flight-manual-correction-ybtour'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import { parseProductRawMetaPublic } from '@/lib/public-product-extras'
import {
  pickPrimaryAirlineNameForOperationalMeeting,
  resolveOperationalMeetingDisplay,
} from '@/lib/meeting-airline-operational-ssot'
import { computeAdminProductSupplierDerivatives } from '@/lib/admin-product-supplier-derivatives'
import { LISTING_KIND_VALUES, TRAVEL_SCOPE_VALUES } from '@/lib/product-listing-kind'
import {
  getImageStorageBucket,
  isObjectStorageConfigured,
  tryParseObjectKeyFromPublicUrl,
} from '@/lib/object-storage'
import { extractPexelsPhotoIdFromCdnUrl } from '@/lib/product-pexels-image-rehost'
import { toHeroStorageSourceTypeSegment } from '@/lib/product-hero-image-source-type'
import { rehostPexelsUrlsInScheduleEntries, type ScheduleEntryRecord } from '@/lib/schedule-day-image-rehost'
import { internalizeProductCoverImageUrl } from '@/lib/travel-product-image-internalize'

type RouteParams = { params: Promise<{ id: string }> }

function originForFlightManualModulePick(
  deriv: ReturnType<typeof computeAdminProductSupplierDerivatives>,
  rawOrigin: string | null | undefined
) {
  return deriv.normalizedOriginSupplier !== 'etc' ? deriv.normalizedOriginSupplier : (rawOrigin ?? '')
}

function pickFlightManualModule(brandKey: string | null | undefined, originSource: string | null | undefined) {
  switch (resolvePublicConsumptionModuleKey(brandKey, originSource)) {
    case 'modetour':
      return flightManualModetour
    case 'verygoodtour':
      return flightManualVerygoodtour
    case 'ybtour':
      return flightManualYbtour
    default:
      return flightManualHanatour
  }
}

function buildStructuredSignalsPreviewForAdmin(
  rawMeta: string | null | undefined,
  departureCarrierFirst: string | null,
  productAirline: string | null
) {
  const rawParsed = parseProductRawMetaPublic(rawMeta ?? null)
  const sig = rawParsed?.structuredSignals
  const shopSr = sig?.shoppingStructured?.rows
  if (sig == null) return null
  const meeting = resolveOperationalMeetingDisplay(
    pickPrimaryAirlineNameForOperationalMeeting({
      departureCarrierFirst,
      structuredAirlineName: (sig.airlineName as string | undefined) ?? null,
      productAirline,
    })
  )
  return {
    remainingSeatsCount: sig.remainingSeatsCount ?? null,
    currentBookedCount: sig.currentBookedCount ?? null,
    minimumDepartureCount: sig.minimumDepartureCount ?? null,
    departureStatusText: sig.departureStatusText ?? null,
    meetingInfoRaw: meeting.meetingInfoRaw,
    meetingPlaceRaw: meeting.meetingPlaceRaw,
    meetingFallbackText: meeting.meetingFallbackText,
    shoppingVisitCount: sig.shoppingVisitCount ?? null,
    shoppingRows:
      Array.isArray(shopSr) && shopSr.length > 0
        ? shopSr.slice(0, 24).map((r) => ({
            city: r.city ?? null,
            shopName: r.shopName ?? null,
            shopLocation: r.shopLocation ?? null,
            itemsText: r.itemsText ?? null,
            shoppingItem: r.shoppingItem ?? '',
            shoppingPlace: r.shoppingPlace ?? '',
            durationText: r.durationText ?? '',
            noteText: r.noteText ?? null,
          }))
        : null,
  }
}

/**
 * GET /api/admin/products/[id] — 단일 상품. 인증: 관리자.
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
      select: {
        id: true,
        originSource: true,
        brand: { select: { brandKey: true } },
        originCode: true,
        originUrl: true,
        title: true,
        destination: true,
        destinationRaw: true,
        primaryDestination: true,
        supplierGroupId: true,
        productType: true,
        airtelHotelInfoJson: true,
        airportTransferType: true,
        optionalToursStructured: true,
        priceFrom: true,
        priceCurrency: true,
        duration: true,
        airline: true,
        bgImageUrl: true,
        bgImageSource: true,
        bgImagePhotographer: true,
        bgImageSourceUrl: true,
        bgImageExternalId: true,
        bgImageIsGenerated: true,
        bgImageStoragePath: true,
        bgImageStorageBucket: true,
        bgImageRehostSearchLabel: true,
        bgImagePlaceName: true,
        bgImageCityName: true,
        bgImageWidth: true,
        bgImageHeight: true,
        bgImageRehostedAt: true,
        bgImageSourceType: true,
        schedule: true,
        isFuelIncluded: true,
        isGuideFeeIncluded: true,
        mandatoryLocalFee: true,
        mandatoryCurrency: true,
        includedText: true,
        excludedText: true,
        hotelSummaryRaw: true,
        criticalExclusions: true,
        shoppingCount: true,
        shoppingItems: true,
        shoppingShopOptions: true,
        registrationStatus: true,
        primaryRegion: true,
        themeTags: true,
        displayCategory: true,
        targetAudience: true,
        rejectReason: true,
        rejectedAt: true,
        needsImageReview: true,
        imageReviewRequestedAt: true,
        createdAt: true,
        updatedAt: true,
        prices: { orderBy: { date: 'asc' } },
        itineraries: { orderBy: { day: 'asc' } },
        optionalTours: true,
        rawMeta: true,
        counselingNotes: true,
        benefitSummary: true,
        travelScope: true,
        listingKind: true,
        departures: { orderBy: { departureDate: 'asc' }, take: 1, select: { carrierName: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const firstDepCarrierGet = product.departures?.[0]?.carrierName ?? null
    const supplierDeriv = computeAdminProductSupplierDerivatives({
      brandKey: product.brand?.brandKey ?? null,
      originSource: product.originSource,
    })
    return NextResponse.json({
      ...adminProductJsonWithPromotionRef(product),
      ...supplierDeriv,
      structuredSignalsPreview: buildStructuredSignalsPreviewForAdmin(
        product.rawMeta ?? null,
        firstDepCarrierGet,
        product.airline ?? null
      ),
      flightAdminJson: getFlightAdminJsonFromRawMeta(product.rawMeta ?? null),
      flightManualCorrection: pickFlightManualModule(
        supplierDeriv.canonicalBrandKey ?? product.brand?.brandKey,
        originForFlightManualModulePick(supplierDeriv, product.originSource)
      ).getFlightManualCorrectionFromRawMeta(product.rawMeta ?? null),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/products/[id]. 인증: 관리자.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const body = (await request.json()) as Record<string, unknown>
    const MAX_STR = 500
    const MAX_REJECT_REASON = 200
    const strOrNull = (v: unknown, max = MAX_STR): string | null =>
      v == null ? null : String(v).trim().slice(0, max) || null
    const MAX_URL = 2000
    const MAX_DETAIL = 32000
    const data: {
      title?: string | null
      duration?: string | null
      airline?: string | null
      includedText?: string | null
      excludedText?: string | null
      hotelSummaryRaw?: string | null
      criticalExclusions?: string | null
      counselingNotes?: string | null
      benefitSummary?: string | null
      travelScope?: string | null
      listingKind?: string | null
      schedule?: string | null
      registrationStatus?: string | null
      rejectReason?: string | null
      rejectedAt?: Date | null
      primaryRegion?: string | null
      themeTags?: string | null
      displayCategory?: string | null
      targetAudience?: string | null
      destinationRaw?: string | null
      primaryDestination?: string | null
      supplierGroupId?: string | null
      productType?: string | null
      airtelHotelInfoJson?: string | null
      airportTransferType?: string | null
      optionalToursStructured?: string | null
      priceFrom?: number | null
      priceCurrency?: string | null
      bgImageUrl?: string | null
      bgImageSource?: string | null
      bgImagePhotographer?: string | null
      bgImageSourceUrl?: string | null
      bgImageExternalId?: string | null
      bgImageIsGenerated?: boolean
      bgImageStoragePath?: string | null
      bgImageStorageBucket?: string | null
      bgImageRehostSearchLabel?: string | null
      bgImagePlaceName?: string | null
      bgImageCityName?: string | null
      bgImageWidth?: number | null
      bgImageHeight?: number | null
      bgImageRehostedAt?: Date | null
      bgImageSourceType?: string | null
      needsImageReview?: boolean
      imageReviewRequestedAt?: Date | null
      rawMeta?: string | null
    } = {}
    if (body.flightAdminJson !== undefined || body.flightManualCorrection !== undefined) {
      const current = await prisma.product.findUnique({
        where: { id },
        select: {
          rawMeta: true,
          originSource: true,
          brand: { select: { brandKey: true } },
        },
      })
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      let nextMeta: string | null = current.rawMeta ?? null
      if (body.flightAdminJson !== undefined) {
        const raw = body.flightAdminJson == null ? null : String(body.flightAdminJson).trim()
        if (raw) {
          try {
            JSON.parse(raw)
          } catch {
            return NextResponse.json({ error: 'flightAdminJson은 유효한 JSON이어야 합니다.' }, { status: 400 })
          }
        }
        nextMeta = mergeFlightAdminJsonIntoRawMeta(nextMeta, raw || null)
      }
      if (body.flightManualCorrection !== undefined) {
        const p = body.flightManualCorrection
        const derivCurrent = computeAdminProductSupplierDerivatives({
          brandKey: current.brand?.brandKey ?? null,
          originSource: current.originSource,
        })
        const fmc = pickFlightManualModule(
          derivCurrent.canonicalBrandKey ?? current.brand?.brandKey,
          originForFlightManualModulePick(derivCurrent, current.originSource)
        )
        const normalized =
          p == null ? null : fmc.normalizeFlightManualCorrectionPayload(p as Record<string, unknown>)
        nextMeta = mergeFlightManualCorrectionIntoRawMeta(nextMeta, normalized)
      }
      data.rawMeta = nextMeta
    }
    if (body.title !== undefined) {
      data.title = strOrNull(body.title, 500) ?? '상품명 없음'
    }
    if (body.duration !== undefined) {
      data.duration = strOrNull(body.duration, 80)
    }
    if (body.airline !== undefined) {
      data.airline = strOrNull(body.airline, 120)
    }
    if (body.includedText !== undefined) {
      data.includedText = strOrNull(body.includedText, MAX_DETAIL)
    }
    if (body.excludedText !== undefined) {
      data.excludedText = strOrNull(body.excludedText, MAX_DETAIL)
    }
    if (body.hotelSummaryRaw !== undefined) {
      data.hotelSummaryRaw = strOrNull(body.hotelSummaryRaw, MAX_DETAIL)
    }
    if (body.criticalExclusions !== undefined) {
      data.criticalExclusions = strOrNull(body.criticalExclusions)
    }
    if (body.counselingNotes !== undefined) {
      data.counselingNotes = body.counselingNotes == null ? null : strOrNull(body.counselingNotes, MAX_DETAIL)
    }
    if (body.benefitSummary !== undefined) {
      data.benefitSummary = strOrNull(body.benefitSummary, MAX_DETAIL)
    }
    if (body.travelScope !== undefined) {
      const raw = body.travelScope
      if (raw == null || raw === '') {
        data.travelScope = null
      } else {
        const v = String(raw).trim()
        if (!(TRAVEL_SCOPE_VALUES as readonly string[]).includes(v)) {
          return NextResponse.json(
            { error: 'travelScope는 domestic 또는 overseas 이어야 합니다.' },
            { status: 400 }
          )
        }
        data.travelScope = v
      }
    }
    if (body.listingKind !== undefined) {
      const raw = body.listingKind
      if (raw == null || raw === '') {
        data.listingKind = null
      } else {
        const v = String(raw).trim()
        if (!(LISTING_KIND_VALUES as readonly string[]).includes(v)) {
          return NextResponse.json(
            { error: 'listingKind는 travel, private_trip, air_hotel_free 중 하나여야 합니다.' },
            { status: 400 }
          )
        }
        data.listingKind = v
      }
    }
    if (body.schedule !== undefined) {
      if (body.schedule == null) {
        data.schedule = null
      } else {
        const raw =
          typeof body.schedule === 'string' ? body.schedule : JSON.stringify(body.schedule)
        if (isObjectStorageConfigured()) {
          try {
            const parsed = JSON.parse(raw) as unknown
            if (Array.isArray(parsed)) {
              const productShort = await prisma.product.findUnique({
                where: { id },
                select: { primaryDestination: true, destinationRaw: true, destination: true },
              })
              const cityFb =
                productShort?.primaryDestination?.trim() ||
                productShort?.destinationRaw?.trim() ||
                productShort?.destination?.trim() ||
                null
              const nextArr = await rehostPexelsUrlsInScheduleEntries(
                prisma,
                id,
                parsed as ScheduleEntryRecord[],
                (_day, row) => {
                  const kw = typeof row.imageKeyword === 'string' ? String(row.imageKeyword).trim() : ''
                  const placeGuess = kw ? kw.split(/[|,]/)[0]?.trim() || null : null
                  return {
                    placeName: placeGuess,
                    cityName: cityFb,
                    searchKeyword: kw || placeGuess || cityFb,
                  }
                }
              )
              data.schedule = JSON.stringify(nextArr)
            } else {
              data.schedule = raw
            }
          } catch {
            data.schedule = raw
          }
        } else {
          data.schedule = raw
        }
      }
    }
    if (body.registrationStatus !== undefined) {
      const v = body.registrationStatus
      const allowed = ['pending', 'registered', 'on_hold', 'rejected'] as const
      data.registrationStatus = typeof v === 'string' && allowed.includes(v as (typeof allowed)[number]) ? v : null
      if (data.registrationStatus === 'registered') {
        const [departureCount, itineraryDayCount] = await Promise.all([
          prisma.productDeparture.count({ where: { productId: id } }),
          prisma.itineraryDay.count({ where: { productId: id } }),
        ])
        if (departureCount === 0 || itineraryDayCount === 0) {
          return NextResponse.json(
            {
              error:
                '등록 확정 전 ProductDeparture(일자별 가격/상태)와 ItineraryDay(원문 일정표) 수집이 필요합니다.',
              missing: {
                departures: departureCount === 0,
                itineraryDays: itineraryDayCount === 0,
              },
            },
            { status: 400 }
          )
        }
      }
      if (data.registrationStatus === 'rejected') {
        data.rejectReason = strOrNull(body.rejectReason, MAX_REJECT_REASON)
        data.rejectedAt = new Date()
      } else {
        data.rejectReason = null
        data.rejectedAt = null
      }
    }
    if (body.primaryRegion !== undefined) data.primaryRegion = strOrNull(body.primaryRegion)
    if (body.destinationRaw !== undefined) data.destinationRaw = strOrNull(body.destinationRaw)
    if (body.primaryDestination !== undefined) data.primaryDestination = strOrNull(body.primaryDestination)
    if (body.supplierGroupId !== undefined) data.supplierGroupId = strOrNull(body.supplierGroupId)
    if (body.productType !== undefined) data.productType = strOrNull(body.productType, 40)
    if (body.airtelHotelInfoJson !== undefined) data.airtelHotelInfoJson = strOrNull(body.airtelHotelInfoJson, 32000)
    if (body.airportTransferType !== undefined) data.airportTransferType = strOrNull(body.airportTransferType, 20)
    if (body.optionalToursStructured !== undefined) data.optionalToursStructured = strOrNull(body.optionalToursStructured, 32000)
    if (body.priceFrom !== undefined) data.priceFrom = typeof body.priceFrom === 'number' ? body.priceFrom : null
    if (body.priceCurrency !== undefined) data.priceCurrency = strOrNull(body.priceCurrency)
    if (body.themeTags !== undefined) data.themeTags = strOrNull(body.themeTags)
    if (body.displayCategory !== undefined) data.displayCategory = strOrNull(body.displayCategory)
    if (body.targetAudience !== undefined) data.targetAudience = strOrNull(body.targetAudience)
    // 대표 이미지 (Pexels 선택 등): primaryImage* → bgImage* (URL 비우면 메타도 null)
    if (body.primaryImageUrl !== undefined) {
      let url = String(body.primaryImageUrl).trim().slice(0, MAX_URL) || null
      const srcLower = String(body.primaryImageSource ?? '').trim().toLowerCase()
      const isPexelsSource = srcLower === 'pexels'

      const clearPexelsStorageMeta = () => {
        data.bgImageStoragePath = null
        data.bgImageStorageBucket = null
        data.bgImageRehostSearchLabel = null
        data.bgImagePlaceName = null
        data.bgImageCityName = null
        data.bgImageWidth = null
        data.bgImageHeight = null
        data.bgImageRehostedAt = null
        data.bgImageSourceType = null
      }

      let pexelsIdResolvedForDb: string | null = null

      if (!url) {
        clearPexelsStorageMeta()
      } else if (isPexelsSource) {
        const needRehost =
          url.includes('images.pexels.com') ||
          (url.toLowerCase().includes('pexels.com') && url.toLowerCase().includes('photo'))
        const idRaw = body.primaryImageExternalId
        const pidFromBody = idRaw != null ? Number(String(idRaw).trim()) : NaN
        const pidFromUrl = extractPexelsPhotoIdFromCdnUrl(url)
        const pid =
          Number.isInteger(pidFromBody) && pidFromBody > 0 ? pidFromBody : pidFromUrl != null ? pidFromUrl : NaN
        const isNumericPexelsId = Number.isInteger(pid) && pid > 0
        if (isNumericPexelsId) pexelsIdResolvedForDb = String(pid)

        if (needRehost) {
          if (!isNumericPexelsId) {
            return NextResponse.json(
              { error: 'Pexels 대표 이미지는 사진 ID(URL 경로 또는 primaryImageExternalId)가 필요합니다.' },
              { status: 400 }
            )
          }
          const prodShort = await prisma.product.findUnique({
            where: { id },
            select: {
              primaryDestination: true,
              destinationRaw: true,
              destination: true,
            },
          })
          const placeFromBody = strOrNull(body.primaryImagePlaceName, 200)
          const cityFromBody = strOrNull(body.primaryImageCityName, 200)
          const searchFromBody = strOrNull(body.primaryImageSearchKeyword, 300)
          const cityFallback =
            cityFromBody != null
              ? cityFromBody
              : prodShort?.primaryDestination?.trim() ||
                prodShort?.destinationRaw?.trim() ||
                prodShort?.destination?.trim() ||
                null
          const placeName = placeFromBody
          const cityName = cityFallback
          const searchLabel =
            searchFromBody != null
              ? searchFromBody
              : placeName != null
                ? placeName
                : cityName != null
                  ? cityName
                  : null

          try {
            const destLine =
              prodShort?.primaryDestination?.trim() ||
              prodShort?.destinationRaw?.trim() ||
              prodShort?.destination?.trim() ||
              'unknown'
            url = await internalizeProductCoverImageUrl(prisma, {
              remoteUrl: url,
              destination: destLine,
              poolAttractionLabel: 'primary_cover',
              poolSource: 'pexels',
              pexelsPhotoId: pid,
              photographer: strOrNull(body.primaryImagePhotographer, 200),
              pexelsPageUrl: strOrNull(body.primaryImageSourceUrl, MAX_URL),
              searchKeyword: searchLabel,
              placeName,
              cityName,
            })
            const key = tryParseObjectKeyFromPublicUrl(url)
            data.bgImageStoragePath = key
            data.bgImageStorageBucket = key ? getImageStorageBucket() : null
            data.bgImageRehostSearchLabel = searchLabel
            data.bgImagePlaceName = placeName
            data.bgImageCityName = cityName
            data.bgImageWidth = null
            data.bgImageHeight = null
            data.bgImageRehostedAt = new Date()
            data.bgImageSourceType = toHeroStorageSourceTypeSegment('pexels')
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Pexels 이미지 저장 실패'
            console.error('[PATCH product] pexels internalize', e)
            return NextResponse.json({ error: msg }, { status: 503 })
          }
        }
        // 이미 우리 Storage URL이면 storage 메타는 PATCH에서 건드리지 않음(기존 행 유지)
      } else {
        clearPexelsStorageMeta()
        if (
          url &&
          /^https?:\/\//i.test(url) &&
          tryParseObjectKeyFromPublicUrl(url) == null &&
          isObjectStorageConfigured()
        ) {
          try {
            const prodShort = await prisma.product.findUnique({
              where: { id },
              select: { primaryDestination: true, destinationRaw: true, destination: true },
            })
            const destLine =
              prodShort?.primaryDestination?.trim() ||
              prodShort?.destinationRaw?.trim() ||
              prodShort?.destination?.trim() ||
              'unknown'
            url = await internalizeProductCoverImageUrl(prisma, {
              remoteUrl: url,
              destination: destLine,
              poolAttractionLabel: 'primary_cover',
              poolSource: srcLower || 'manual',
              pexelsPhotoId: null,
              photographer: strOrNull(body.primaryImagePhotographer, 200),
              pexelsPageUrl: strOrNull(body.primaryImageSourceUrl, MAX_URL),
              searchKeyword: 'primary',
              placeName: null,
              cityName: destLine.split(',')[0]?.trim() || destLine,
            })
            const key = tryParseObjectKeyFromPublicUrl(url)
            data.bgImageStoragePath = key
            data.bgImageStorageBucket = key ? getImageStorageBucket() : null
            data.bgImageRehostSearchLabel = null
            data.bgImagePlaceName = null
            data.bgImageCityName = destLine.split(',')[0]?.trim() || destLine
            data.bgImageWidth = null
            data.bgImageHeight = null
            data.bgImageRehostedAt = new Date()
            data.bgImageSourceType = toHeroStorageSourceTypeSegment(srcLower || 'manual')
          } catch (e) {
            const msg = e instanceof Error ? e.message : '대표 이미지 Storage 저장 실패'
            console.error('[PATCH product] cover internalize', e)
            return NextResponse.json({ error: msg }, { status: 503 })
          }
        }
      }

      data.bgImageUrl = url
      data.bgImageSource = url ? strOrNull(body.primaryImageSource, 100) : null
      data.bgImagePhotographer = url ? strOrNull(body.primaryImagePhotographer, 200) : null
      data.bgImageSourceUrl = url ? strOrNull(body.primaryImageSourceUrl, MAX_URL) : null
      data.bgImageExternalId = url ? (strOrNull(body.primaryImageExternalId, 100) ?? pexelsIdResolvedForDb) : null
      if (!url) {
        data.bgImageIsGenerated = false
      } else if (body.primaryImageIsGenerated === undefined) {
        const s = String(data.bgImageSource ?? '').trim().toLowerCase()
        data.bgImageIsGenerated = s === 'gemini' || s === 'gemini_auto' || s === 'gemini_manual'
      }
    } else if (
      body.primaryImageSource !== undefined ||
      body.primaryImagePhotographer !== undefined ||
      body.primaryImageSourceUrl !== undefined ||
      body.primaryImageExternalId !== undefined
    ) {
      // 대표 이미지 URL 유지 — 출처·작가·원본 링크만 수정 (상품 상세에서 iStock 등 표기용)
      if (body.primaryImageSource !== undefined) {
        data.bgImageSource = strOrNull(body.primaryImageSource, 100)
        if (body.primaryImageIsGenerated === undefined) {
          const s = String(data.bgImageSource ?? '').trim().toLowerCase()
          data.bgImageIsGenerated = s === 'gemini' || s === 'gemini_auto' || s === 'gemini_manual'
        }
      }
      if (body.primaryImagePhotographer !== undefined) {
        data.bgImagePhotographer =
          body.primaryImagePhotographer == null ? null : strOrNull(body.primaryImagePhotographer, 200)
      }
      if (body.primaryImageSourceUrl !== undefined) {
        data.bgImageSourceUrl =
          body.primaryImageSourceUrl == null ? null : strOrNull(body.primaryImageSourceUrl, MAX_URL)
      }
      if (body.primaryImageExternalId !== undefined) {
        data.bgImageExternalId =
          body.primaryImageExternalId == null ? null : strOrNull(body.primaryImageExternalId, 100)
      }
    }
    if (body.primaryImageIsGenerated !== undefined) {
      data.bgImageIsGenerated = body.primaryImageIsGenerated === true
    }
    if (data.bgImageUrl && data.bgImageSource != null && String(data.bgImageSource).trim()) {
      const src = String(data.bgImageSource).trim().toLowerCase()
      const aiSource = src === 'gemini' || src === 'gemini_auto' || src === 'gemini_manual'
      if (!aiSource) {
        data.bgImageIsGenerated = false
      }
    }
    if (body.needsImageReview !== undefined) {
      data.needsImageReview = body.needsImageReview === true
      data.imageReviewRequestedAt = data.needsImageReview ? new Date() : null
    }
    // 이미지 출처를 확정하면 보강 검수 플래그 해제
    const knownSources = new Set([
      'pexels',
      'gemini',
      'gemini_auto',
      'gemini_manual',
      'manual',
      'destination-set',
      'photopool',
      'photo_owned',
      'city-asset',
      'attraction-asset',
      'istock',
      'other',
    ])
    if (data.bgImageSource != null && String(data.bgImageSource).trim() && knownSources.has(String(data.bgImageSource).trim().toLowerCase())) {
      data.needsImageReview = false
      data.imageReviewRequestedAt = null
    }
    if (Object.keys(data).length > 0) {
      await prisma.product.update({
        where: { id },
        data: data as Prisma.ProductUpdateInput,
      })
    }
    if (
      body.firstPriceRow &&
      typeof body.firstPriceRow === 'object' &&
      (body.firstPriceRow as Record<string, unknown>).priceAdult != null
    ) {
      const row = body.firstPriceRow as Record<string, unknown>
      const first = await prisma.productPrice.findFirst({
        where: { productId: id },
        orderBy: { date: 'asc' },
        select: { id: true },
      })
      if (first) {
        await prisma.productPrice.update({
          where: { id: first.id },
          data: {
            ...(row.priceAdult != null && { adult: Number(row.priceAdult) }),
            ...(row.priceChildWithBed != null && { childBed: Number(row.priceChildWithBed) }),
            ...(row.priceChildNoBed != null && { childNoBed: Number(row.childNoBed) }),
            ...(row.priceInfant != null && { infant: Number(row.priceInfant) }),
          },
        })
      }
    }
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        originSource: true,
        brand: { select: { brandKey: true } },
        originCode: true,
        originUrl: true,
        title: true,
        destination: true,
        destinationRaw: true,
        primaryDestination: true,
        supplierGroupId: true,
        productType: true,
        airtelHotelInfoJson: true,
        airportTransferType: true,
        optionalToursStructured: true,
        priceFrom: true,
        priceCurrency: true,
        duration: true,
        airline: true,
        bgImageUrl: true,
        bgImageSource: true,
        bgImagePhotographer: true,
        bgImageSourceUrl: true,
        bgImageExternalId: true,
        bgImageIsGenerated: true,
        bgImageStoragePath: true,
        bgImageStorageBucket: true,
        bgImageRehostSearchLabel: true,
        bgImagePlaceName: true,
        bgImageCityName: true,
        bgImageWidth: true,
        bgImageHeight: true,
        bgImageRehostedAt: true,
        bgImageSourceType: true,
        schedule: true,
        isFuelIncluded: true,
        isGuideFeeIncluded: true,
        mandatoryLocalFee: true,
        mandatoryCurrency: true,
        includedText: true,
        excludedText: true,
        hotelSummaryRaw: true,
        criticalExclusions: true,
        shoppingCount: true,
        shoppingItems: true,
        shoppingShopOptions: true,
        registrationStatus: true,
        primaryRegion: true,
        themeTags: true,
        displayCategory: true,
        targetAudience: true,
        rejectReason: true,
        rejectedAt: true,
        needsImageReview: true,
        imageReviewRequestedAt: true,
        createdAt: true,
        updatedAt: true,
        prices: { orderBy: { date: 'asc' } },
        itineraries: { orderBy: { day: 'asc' } },
        optionalTours: true,
        rawMeta: true,
        counselingNotes: true,
        benefitSummary: true,
        travelScope: true,
        listingKind: true,
        departures: { orderBy: { departureDate: 'asc' }, take: 1, select: { carrierName: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const firstDepCarrierPatch = product.departures?.[0]?.carrierName ?? null
    const supplierDerivPatch = computeAdminProductSupplierDerivatives({
      brandKey: product.brand?.brandKey ?? null,
      originSource: product.originSource,
    })
    return NextResponse.json({
      ...adminProductJsonWithPromotionRef(product),
      ...supplierDerivPatch,
      structuredSignalsPreview: buildStructuredSignalsPreviewForAdmin(
        product.rawMeta ?? null,
        firstDepCarrierPatch,
        product.airline ?? null
      ),
      flightAdminJson: getFlightAdminJsonFromRawMeta(product.rawMeta ?? null),
      flightManualCorrection: pickFlightManualModule(
        supplierDerivPatch.canonicalBrandKey ?? product.brand?.brandKey,
        originForFlightManualModulePick(supplierDerivPatch, product.originSource)
      ).getFlightManualCorrectionFromRawMeta(product.rawMeta ?? null),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/products/[id]. 인증: 관리자.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const bookingCount = await prisma.booking.count({ where: { productId: id } })
    if (bookingCount > 0) {
      return NextResponse.json(
        { error: '예약이 있는 상품은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
