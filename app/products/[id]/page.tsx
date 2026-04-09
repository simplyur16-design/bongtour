import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { parseCounselingNotes } from '@/lib/parsed-product-types'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import {
  sanitizeFlightStructuredBodyForPublic,
  toPublicPersistedFlightStructured,
} from '@/lib/public-flight-structured-sanitize'
import Header from '@/app/components/Header'
import TravelProductDetail from '@/app/components/travel/TravelProductDetail'
import MobileProductDetail from '@/app/components/travel/MobileProductDetail'
import VerygoodTravelProductDetail from '@/app/components/travel/verygood/VerygoodTravelProductDetail'
import VerygoodMobileProductDetail from '@/app/components/travel/verygood/VerygoodMobileProductDetail'
import YbtourTravelProductDetail from '@/app/components/travel/ybtour/YbtourTravelProductDetail'
import YbtourMobileProductDetail from '@/app/components/travel/ybtour/YbtourMobileProductDetail'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import * as priceRowsHanatour from '@/lib/product-departure-to-price-rows-hanatour'
import * as priceRowsModetour from '@/lib/product-departure-to-price-rows-modetour'
import * as priceRowsVerygoodtour from '@/lib/product-departure-to-price-rows-verygoodtour'
import * as priceRowsYbtour from '@/lib/product-departure-to-price-rows-ybtour'
import {
  extractProductPriceTableByLabels,
  mergeProductPriceTableWithLabelExtract,
} from '@/lib/product-price-table-extract'
import {
  normalizeMustKnowItems,
  parseProductRawMetaPublic,
  parseShoppingStopsJson,
} from '@/lib/public-product-extras'
import {
  pickPrimaryAirlineNameForOperationalMeeting,
  resolveOperationalMeetingDisplay,
} from '@/lib/meeting-airline-operational-ssot'
import * as publicConsumptionHanatour from '@/lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '@/lib/public-consumption-modetour'
import * as publicConsumptionVerygoodtour from '@/lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '@/lib/public-consumption-ybtour'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import {
  buildModetourDirectedDisplayFromFlightStructured,
  buildModetourDirectedDisplayFromStructuredBody,
} from '@/lib/flight-modetour-parser'
import {
  buildDepartureKeyFactsMap,
  departureLegHasContent,
  enrichDepartureKeyFactsMapForDisplay,
  mergeAdminDepartureFactsWithParsedLegs,
} from '@/lib/departure-key-facts'
import {
  resolveVerygoodPublicAirlineForPublicDetail,
  tryVerygoodLegsFromFlightBody,
} from '@/lib/flight-verygood-public-display'
import {
  buildKeyFactsFromAdminProfile,
  parseFlightAdminJson,
  resolveFlightDisplayPolicy,
} from '@/lib/admin-flight-profile'
import { getFlightAdminJsonFromRawMeta } from '@/lib/raw-meta-admin-flight'
import * as flightManualHanatour from '@/lib/flight-manual-correction-hanatour'
import * as flightManualModetour from '@/lib/flight-manual-correction-modetour'
import * as flightManualVerygoodtour from '@/lib/flight-manual-correction-verygoodtour'
import * as flightManualYbtour from '@/lib/flight-manual-correction-ybtour'
import * as dayHotelHanatour from '@/lib/day-hotel-plans-hanatour'
import * as dayHotelModetour from '@/lib/day-hotel-plans-modetour'
import * as dayHotelVerygoodtour from '@/lib/day-hotel-plans-verygoodtour'
import * as dayHotelYbtour from '@/lib/day-hotel-plans-ybtour'
import { normalizePromotionMarketingCopy, normalizePricePromotionViewCopy } from '@/lib/promotion-copy-normalize'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import { tryApplyVerygoodPublicProductSerializedPatch } from '@/lib/verygood-public-product-detail-patch'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { tryCaptionFromPublicImageUrl } from '@/lib/image-asset-public-caption'
import ProductJsonLd from '@/app/components/seo/ProductJsonLd'
import ProductDetailCopyGuard from '@/app/components/travel/ProductDetailCopyGuard'
import {
  absoluteUrl,
  buildPublicProductDescription,
  DEFAULT_OG_IMAGE_PATH,
  SITE_NAME,
  toAbsoluteImageUrl,
} from '@/lib/site-metadata'
import {
  formatModetourStickyLocalPayPerPersonLine,
  sanitizeModetourPublicDepartureKeyFacts,
  sanitizeModetourPublicProductAirlineLine,
} from '@/lib/modetour-product-public-display'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await prisma.product.findFirst({
    where: { id, registrationStatus: 'registered' },
    select: {
      id: true,
      title: true,
      primaryDestination: true,
      destination: true,
      bgImageUrl: true,
      schedule: true,
      itineraries: { orderBy: { day: 'asc' }, select: { day: true, description: true } },
    },
  })
  if (!p) {
    return { title: '상품' }
  }
  const scheduleRows = getScheduleFromProduct(p)
  const coverUrl = getFinalCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays: scheduleRows })
  const ogImage =
    toAbsoluteImageUrl(coverUrl) ?? absoluteUrl(DEFAULT_OG_IMAGE_PATH)
  const desc = buildPublicProductDescription({
    title: p.title,
    primaryDestination: p.primaryDestination,
    destination: p.destination,
  })
  const dest = (p.primaryDestination ?? p.destination ?? '').trim()
  const path = `/products/${p.id}`
  const titleSeg = `${p.title}${dest ? ` · ${dest}` : ''} · 여행 상품 안내`
  const scheduleImageCaption = scheduleRows.find((d) => d.imageDisplayName?.trim())?.imageDisplayName?.trim()
  const captionFromImageAsset = await tryCaptionFromPublicImageUrl(coverUrl)
  const ogCaption = scheduleImageCaption || captionFromImageAsset
  const ogImageAlt = ogCaption ? `${p.title} — ${ogCaption}` : p.title
  return {
    title: titleSeg,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title: `${p.title} | ${SITE_NAME}`,
      description: desc,
      url: path,
      type: 'website',
      images: [{ url: ogImage, alt: ogImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${p.title} | ${SITE_NAME}`,
      description: desc,
      images: [ogImage],
    },
  }
}

/**
 * 상세페이지 단일 렌더링: Prisma Product 한 건만 사용.
 * - 있으면 항상 동일 직렬화 → TravelProductDetail / MobileProductDetail.
 * - 없으면 notFound.
 * - 일정: Product.schedule 단기 SSOT 정책에 따라 getScheduleFromProduct(product)만 사용.
 *   (schedule JSON 우선, 없을 때만 Itinerary fallback. 상세 UI는 이 결과만 씀.)
 */
export default async function ProductDetailPage({ params }: Props) {
  const resolvedParams = await params
  const id = resolvedParams?.id
  if (typeof id !== 'string' || !id.trim()) {
    notFound()
  }
  const travelProduct = await prisma.product.findFirst({
    where: { id, registrationStatus: 'registered' },
    include: {
      prices: { orderBy: { date: 'asc' } },
      departures: { orderBy: { departureDate: 'asc' } },
      itineraries: { orderBy: { day: 'asc' } },
      itineraryDays: { orderBy: { day: 'asc' } },
      optionalTours: true,
      brand: { select: { brandKey: true } },
    },
  })

  if (!travelProduct) {
    notFound()
  }

  const {
    departures: rawDepartures,
    rawMeta: _omitRawMeta,
    itineraryDays: _omitItineraryDays,
    ...productForDetail
  } = travelProduct
  const departures = (rawDepartures ?? []).filter((d) => isOnOrAfterPublicBookableMinDate(d.departureDate))
  const publicPrices = (travelProduct.prices ?? []).filter((p) => isOnOrAfterPublicBookableMinDate(p.date))

  const publicConsumptionModuleKey = resolvePublicConsumptionModuleKey(
    travelProduct.brand?.brandKey,
    travelProduct.originSource
  )
  const publicFlightManualModule = (() => {
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return flightManualModetour
      case 'verygoodtour':
        return flightManualVerygoodtour
      case 'ybtour':
        return flightManualYbtour
      default:
        return flightManualHanatour
    }
  })()

  const publicDayHotelModule = (() => {
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return dayHotelModetour
      case 'verygoodtour':
        return dayHotelVerygoodtour
      case 'ybtour':
        return dayHotelYbtour
      default:
        return dayHotelHanatour
    }
  })()

  const publicPriceRowsModule = (() => {
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return priceRowsModetour
      case 'verygoodtour':
        return priceRowsVerygoodtour
      case 'ybtour':
        return priceRowsYbtour
      default:
        return priceRowsHanatour
    }
  })()

  const rawParsed = parseProductRawMetaPublic(travelProduct.rawMeta ?? null)
  const structured = rawParsed?.structuredSignals

  const scheduleArr = getScheduleFromProduct(travelProduct)
  const dayMeta = new Map((travelProduct.itineraryDays ?? []).map((d) => [d.day, d]))
  const scheduleMergedBase =
    scheduleArr.length > 0
      ? scheduleArr.map((s) => {
          const iday = dayMeta.get(s.day)
          return {
            ...s,
            hotelText: iday?.hotelText ?? null,
            breakfastText: iday?.breakfastText ?? null,
            lunchText: iday?.lunchText ?? null,
            dinnerText: iday?.dinnerText ?? null,
            mealSummaryText: iday?.mealSummaryText ?? null,
          }
        })
      : []
  const scheduleMerged = scheduleMergedBase
  const schedule = scheduleMerged.length > 0 ? scheduleMerged : null

  const seoCoverUrl = getFinalCoverImageUrl({
    bgImageUrl: travelProduct.bgImageUrl,
    scheduleDays: scheduleMerged.length > 0 ? scheduleMerged : null,
  })
  const heroCoverCaptionFromAsset = await tryCaptionFromPublicImageUrl(seoCoverUrl)
  const seoProductDescription = buildPublicProductDescription({
    title: travelProduct.title ?? '',
    primaryDestination: travelProduct.primaryDestination,
    destination: travelProduct.destination,
  })

  const flightManualCorrection = publicFlightManualModule.getFlightManualCorrectionFromRawMeta(
    travelProduct.rawMeta ?? null
  )
  const structuredAny = structured as Record<string, unknown> | null
  const flightStructuredDebug = (() => {
    const fs = structuredAny?.flightStructured
    if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
    const dbg = (fs as { debug?: { supplierBrandKey?: unknown } }).debug
    return dbg && typeof dbg === 'object' && !Array.isArray(dbg) ? dbg : null
  })()
  /** Brand 행이 비어 있어도 등록 시 파서가 남긴 supplierBrandKey 로 모두투어 directed 경로 탄다 */
  const useModetourDirectedParse =
    travelProduct.brand?.brandKey === 'modetour' || flightStructuredDebug?.supplierBrandKey === 'modetour'
  const modetourPersistedFlightStructured: FlightStructured | null = (() => {
    const fs = structuredAny?.flightStructured
    if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
    return fs as FlightStructured
  })()
  const useYbtourHeroFlight =
    travelProduct.brand?.brandKey === 'ybtour' ||
    travelProduct.brand?.brandKey === 'yellowballoon' ||
    flightStructuredDebug?.supplierBrandKey === 'ybtour' ||
    flightStructuredDebug?.supplierBrandKey === 'yellowballoon' ||
    normalizeSupplierOrigin(travelProduct.originSource) === 'ybtour'
  const ybtourFlightStructuredForHeroPublic = useYbtourHeroFlight
    ? toPublicPersistedFlightStructured(modetourPersistedFlightStructured)
    : null
  /** 가격 병합 보정도 동일 조건에서만 활성(다른 공급사에는 미적용) */
  const useModetourPriceMergeContext = useModetourDirectedParse
  const modetourDirectedDisplay = useModetourDirectedParse
    ? buildModetourDirectedDisplayFromStructuredBody(
        structured?.flightRaw ?? null,
        structured?.detailBodyNormalizedRaw ?? null
      ) ?? buildModetourDirectedDisplayFromFlightStructured(modetourPersistedFlightStructured)
    : null
  const pricePromoView = normalizePricePromotionViewCopy(rawParsed?.pricePromotion?.merged ?? null)
  const shoppingStopsFromDb = parseShoppingStopsJson(travelProduct.shoppingShopOptions ?? null)
  const shoppingStopsFromMeta = parseShoppingStopsJson(structured?.shoppingStops ?? null)
  const shoppingConsumption = (() => {
    const input = {
      canonical: structured?.shoppingStructured,
      legacyDbRows: shoppingStopsFromDb,
      legacyMetaRows: shoppingStopsFromMeta,
    }
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return publicConsumptionModetour.resolveShoppingConsumption(input)
      case 'verygoodtour':
        return publicConsumptionVerygoodtour.resolveShoppingConsumption(input)
      case 'ybtour':
        return publicConsumptionYbtour.resolveShoppingConsumption(input)
      default:
        return publicConsumptionHanatour.resolveShoppingConsumption(input)
    }
  })()
  const optionalConsumption = (() => {
    const input = {
      canonical: structured?.optionalToursStructuredCanonical,
      legacyOptionalToursStructured: travelProduct.optionalToursStructured ?? null,
    }
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return publicConsumptionModetour.resolveOptionalToursConsumption(input)
      case 'verygoodtour':
        return publicConsumptionVerygoodtour.resolveOptionalToursConsumption(input)
      case 'ybtour':
        return publicConsumptionYbtour.resolveOptionalToursConsumption(input)
      default:
        return publicConsumptionHanatour.resolveOptionalToursConsumption(input)
    }
  })()
  /** 수동 `hotelSummaryRaw` 경로 제외 — 본문 `hotelInfoRaw`·구조화·일정만 소비 결정에 사용 */
  const hotelConsumption = (() => {
    const input = {
      canonical: structured?.hotelStructured,
      legacyStructuredPlans: structured?.dayHotelPlans ?? null,
      hasLegacyNarrativeFallback: Boolean((structured?.hotelInfoRaw ?? '').trim()),
    }
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return publicConsumptionModetour.resolveHotelConsumption(input)
      case 'verygoodtour':
        return publicConsumptionVerygoodtour.resolveHotelConsumption(input)
      case 'ybtour':
        return publicConsumptionYbtour.resolveHotelConsumption(input)
      default:
        return publicConsumptionHanatour.resolveHotelConsumption(input)
    }
  })()

  /** 항공 enrich: 모두투어 본문 파서·leg 병합은 brand/debug로만 켬 — 타 공급사 자동 적용 금지 */
  const flightStructured = structured
    ? {
        airlineName: modetourDirectedDisplay?.airlineName ?? structured.airlineName ?? null,
        departureSegmentText:
          modetourDirectedDisplay?.departureLine ?? structured.departureSegmentText ?? null,
        returnSegmentText: modetourDirectedDisplay?.returnLine ?? structured.returnSegmentText ?? null,
        routeRaw: structured.routeRaw ?? null,
        flightRaw: structured.flightRaw ?? null,
        detailBodyNormalizedRaw: structured.detailBodyNormalizedRaw ?? null,
        outboundFlightNo: structured.outboundFlightNo ?? null,
        inboundFlightNo: structured.inboundFlightNo ?? null,
        departureDateTimeRaw: structured.departureDateTimeRaw ?? null,
        arrivalDateTimeRaw: structured.arrivalDateTimeRaw ?? null,
        useModetourStructuredFlightLegs: useModetourDirectedParse,
        modetourPersistedFlightStructured: useModetourDirectedParse ? modetourPersistedFlightStructured : null,
      }
    : null
  const parsedFlightExposurePolicy = (() => {
    const fs = structuredAny?.flightStructured
    if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
    const debug = (fs as { debug?: { exposurePolicy?: unknown } }).debug
    const ep = debug?.exposurePolicy
    return ep === 'public_full' || ep === 'public_limited' || ep === 'admin_only' ? ep : null
  })()
  // 항공 표시 정책: 관리자 확정값(rawMeta.structuredSignals.flightAdminJson) 우선,
  // 없으면 본문/출발행 자동 추출(legacy parsed) fallback.
  const adminFlightRaw =
    getFlightAdminJsonFromRawMeta(travelProduct.rawMeta ?? null) ??
    ((travelProduct as { flightAdminJson?: string | null }).flightAdminJson ?? null)
  const adminFlightProfile = parseFlightAdminJson(adminFlightRaw)
  const flightDisplayPolicy = resolveFlightDisplayPolicy(adminFlightProfile)
  const baseFactsByDate = departures.length > 0 ? buildDepartureKeyFactsMap(departures) : {}
  const parsedFactsByDate =
    departures.length > 0
      ? enrichDepartureKeyFactsMapForDisplay(
          baseFactsByDate,
          flightStructured,
          travelProduct.airline ?? null
        )
      : undefined
  const adminFactsTemplate =
    adminFlightProfile != null
      ? buildKeyFactsFromAdminProfile(adminFlightProfile, travelProduct.airline ?? null)
      : null
  let departureKeyFactsByDate =
    departures.length === 0
      ? undefined
      : flightDisplayPolicy === 'admin_only' && adminFactsTemplate != null
        ? Object.fromEntries(
            Object.keys(baseFactsByDate).map((dateKey) => {
              const parsedRow = parsedFactsByDate?.[dateKey]
              const merged =
                parsedRow != null
                  ? mergeAdminDepartureFactsWithParsedLegs(adminFactsTemplate, parsedRow)
                  : adminFactsTemplate
              return [
                dateKey,
                {
                  ...merged,
                  meetingSummary: baseFactsByDate[dateKey]?.meetingSummary ?? merged.meetingSummary ?? null,
                },
              ]
            })
          )
        : flightDisplayPolicy === 'suppress_no_parsed'
          ? Object.fromEntries(
              Object.keys(baseFactsByDate).map((dateKey) => [
                dateKey,
                {
                  airline:
                    adminFactsTemplate?.airline ??
                    baseFactsByDate[dateKey]?.airline ??
                    travelProduct.airline ??
                    null,
                  outbound: null,
                  inbound: null,
                  outboundSummary: null,
                  inboundSummary: null,
                  meetingSummary: baseFactsByDate[dateKey]?.meetingSummary ?? null,
                },
              ])
            )
          : parsedFactsByDate

  const useVerygoodPublicFlightLegs =
    travelProduct.brand?.brandKey === 'verygoodtour' ||
    flightStructuredDebug?.supplierBrandKey === 'verygoodtour'
  if (
    useVerygoodPublicFlightLegs &&
    departureKeyFactsByDate &&
    flightStructured &&
    flightDisplayPolicy !== 'admin_only' &&
    flightDisplayPolicy !== 'suppress_no_parsed'
  ) {
    const vg = tryVerygoodLegsFromFlightBody(flightStructured)
    if (vg && (vg.outbound || vg.inbound)) {
      departureKeyFactsByDate = Object.fromEntries(
        Object.entries(departureKeyFactsByDate).map(([dateKey, facts]) => {
          const outbound =
            vg.outbound && departureLegHasContent(vg.outbound) ? vg.outbound : facts.outbound
          const inbound = vg.inbound && departureLegHasContent(vg.inbound) ? vg.inbound : facts.inbound
          return [dateKey, { ...facts, outbound, inbound }]
        })
      )
    }
    departureKeyFactsByDate = Object.fromEntries(
      Object.entries(departureKeyFactsByDate).map(([dateKey, facts]) => [
        dateKey,
        {
          ...facts,
          airline: resolveVerygoodPublicAirlineForPublicDetail(
            flightStructured,
            facts.airline,
            travelProduct.airline
          ),
        },
      ])
    )
  }

  if (useModetourDirectedParse && departureKeyFactsByDate) {
    departureKeyFactsByDate = Object.fromEntries(
      Object.entries(departureKeyFactsByDate).map(([dateKey, facts]) => [
        dateKey,
        sanitizeModetourPublicDepartureKeyFacts(facts),
      ])
    )
  }

  /** 가격: 본문 라벨 추출 보강·날짜별 아동/유아 후처리는 모두투어 컨텍스트에서만 (타 공급사 공통화 금지) */
  const priceTableRawTrim = structured?.priceTableRawText?.trim() ?? ''
  const modetourLabelPriceExtract =
    useModetourPriceMergeContext && priceTableRawTrim
      ? extractProductPriceTableByLabels(priceTableRawTrim)
      : null
  const productPriceTableForMerge = useModetourPriceMergeContext
    ? mergeProductPriceTableWithLabelExtract(structured?.productPriceTable ?? null, modetourLabelPriceExtract) ??
      structured?.productPriceTable ??
      null
    : structured?.productPriceTable ?? null

  const optionalToursPasteRawPublic =
    typeof structuredAny?.optionalToursPasteRaw === 'string' && structuredAny.optionalToursPasteRaw.trim()
      ? structuredAny.optionalToursPasteRaw.trim()
      : null
  const shoppingPasteRawPublic =
    typeof structuredAny?.shoppingPasteRaw === 'string' && structuredAny.shoppingPasteRaw.trim()
      ? structuredAny.shoppingPasteRaw.trim()
      : null

  const meetingPublic = resolveOperationalMeetingDisplay(
    pickPrimaryAirlineNameForOperationalMeeting({
      departureCarrierFirst: departures[0]?.carrierName ?? null,
      structuredAirlineName: (structured?.airlineName as string | undefined) ?? null,
      productAirline: travelProduct.airline ?? null,
    })
  )

  const mergedPriceRows = publicPriceRowsModule.mergeProductPriceRowsWithBodyPriceTable(
    departures.length > 0
      ? publicPriceRowsModule.productDeparturesToProductPriceRows(departures)
      : publicPrices.map((p) => {
          const dateStr =
            p.date instanceof Date ? p.date.toISOString().slice(0, 10) : String(p.date).slice(0, 10)
          const adultPx = p.adult ?? 0
          const childBedPx = p.childBed != null ? p.childBed : null
          const childNoBedPx = p.childNoBed != null ? p.childNoBed : null
          const infantPx = p.infant != null ? p.infant : null
          return {
            id: p.id,
            productId: p.productId,
            date: dateStr,
            adult: adultPx,
            childBed: childBedPx,
            childNoBed: childNoBedPx,
            infant: infantPx,
            localPrice: p.localPrice,
            priceGap: p.priceGap,
            priceAdult: adultPx,
            priceChildWithBed: childBedPx,
            priceChildNoBed: childNoBedPx,
            priceInfant: infantPx,
          }
        }),
    productPriceTableForMerge,
    useModetourPriceMergeContext ? { modetourVaryingAdultChildLinkage: true } : undefined
  )
  const priceRowsForPublic = Array.isArray(mergedPriceRows) ? mergedPriceRows : []

  const serialized: TravelProduct = {
    ...productForDetail,
    airline: (() => {
      const vgPublic =
        useVerygoodPublicFlightLegs &&
        flightDisplayPolicy !== 'admin_only' &&
        flightDisplayPolicy !== 'suppress_no_parsed'
      const raw = (() => {
        if (!vgPublic) return travelProduct.airline ?? null
        if (departureKeyFactsByDate) {
          const keys = Object.keys(departureKeyFactsByDate).sort()
          if (keys.length) {
            const fromFacts = departureKeyFactsByDate[keys[0]!]?.airline ?? null
            if (fromFacts) return fromFacts
          }
        }
        return resolveVerygoodPublicAirlineForPublicDetail(flightStructured, null, travelProduct.airline)
      })()
      return useModetourDirectedParse ? sanitizeModetourPublicProductAirlineLine(raw) ?? raw : raw
    })(),
    destination: travelProduct.destination ?? '',
    title: travelProduct.title ?? '',
    duration: travelProduct.duration ?? '',
    counselingNotes: parseCounselingNotes(travelProduct.counselingNotes),
    criticalExclusions: travelProduct.criticalExclusions ?? null,
    productType: travelProduct.productType ?? null,
    airportTransferType: travelProduct.airportTransferType ?? null,
    // Temporary compatibility fallback:
    // canonical optionalToursStructuredCanonical -> legacy Product.optionalToursStructured
    optionalToursStructured: optionalConsumption.value,
    optionalTourNoticeRaw: structured?.optionalTourNoticeRaw ?? null,
    optionalTourNoticeItems: structured?.optionalTourNoticeItems ?? [],
    optionalTourDisplayNoticeFinal: structured?.optionalTourDisplayNoticeFinal ?? null,
    optionalToursPasteRaw: optionalToursPasteRawPublic,
    shoppingPasteRaw: shoppingPasteRawPublic,
    shoppingVisitCountTotal: structured?.shoppingVisitCount ?? travelProduct.shoppingVisitCountTotal ?? null,
    shoppingNoticeRaw: structured?.shoppingNoticeRaw ?? travelProduct.shoppingCustomsNoticeRaw ?? null,
    shoppingStopsStructured: shoppingConsumption.value.length > 0 ? shoppingConsumption.value : null,
    freeTimeSummaryText: structured?.freeTimeSummaryText ?? null,
    hasFreeTime: structured?.hasFreeTime ?? null,
    hasOptionalTours: travelProduct.hasOptionalTours ?? null,
    pricePromotionView: pricePromoView,
    benefitSummary:
      normalizePromotionMarketingCopy(travelProduct.benefitSummary) ?? travelProduct.benefitSummary ?? null,
    promotionLabelsRaw:
      normalizePromotionMarketingCopy(travelProduct.promotionLabelsRaw) ??
      travelProduct.promotionLabelsRaw ??
      null,
    priceFrom: travelProduct.priceFrom ?? null,
    priceCurrency: travelProduct.priceCurrency ?? null,
    departureKeyFactsByDate,
    // 관리자 확정 항공이 있으면 자동 파싱 본문값으로 덮어쓰지 않도록 병합 소스를 차단.
    // persisted 모두투어 leg 스냅샷은 debug·modetourParseTrace 등 내부 필드 포함 → 공개용만 통과.
    flightStructured:
      flightDisplayPolicy === 'legacy_parsed' ? sanitizeFlightStructuredBodyForPublic(flightStructured) : null,
    hotelSummaryRaw: travelProduct.hotelSummaryRaw ?? null,
    hotelSummaryText: travelProduct.hotelSummaryText ?? structured?.hotelSummaryText ?? null,
    hotelNames: structured?.hotelNames ?? null,
    dayHotelPlans: (() => {
      const plans = publicDayHotelModule.resolveDayHotelPlansForPublic(
        hotelConsumption.value,
        structured?.hotelInfoRaw ?? null,
        null,
        schedule
      )
      return plans.length > 0 ? plans : null
    })(),
    hotelInfoRaw: structured?.hotelInfoRaw ?? null,
    hotelStatusText: structured?.hotelStatusText ?? null,
    hotelNoticeRaw: structured?.hotelNoticeRaw ?? null,
    priceTableRawText: structured?.priceTableRawText ?? null,
    primaryRegion: travelProduct.primaryRegion ?? null,
    airtelHotelInfoJson: travelProduct.airtelHotelInfoJson ?? null,
    schedule,
    // 출발일/가격 행: ProductDeparture가 있으면 SSOT(하나투어 재수집은 여기만 갱신). 없을 때만 ProductPrice 레거시 fallback.
    prices: priceRowsForPublic,
    optionalTours: (travelProduct as { optionalTours?: { id: string; name: string; priceUsd: number; duration: string | null; waitPlaceIfNotJoined: string | null }[] }).optionalTours?.map((o) => ({
      id: o.id,
      name: o.name,
      priceUsd: o.priceUsd,
      duration: o.duration ?? '',
      waitPlaceIfNotJoined: o.waitPlaceIfNotJoined ?? '',
    })) ?? [],
    shoppingCount: (travelProduct as { shoppingCount?: number | null }).shoppingCount ?? null,
    shoppingItems: (travelProduct as { shoppingItems?: string | null }).shoppingItems ?? null,
    reservationNoticeRaw: travelProduct.reservationNoticeRaw ?? null,
    /** 꼭 알아야 할 사항: structured `mustKnowItems`만 공개 소비. `reservationNoticeRaw`는 이 축에서 쓰지 않음(다른 용도·레거시만 DB 유지 가능). */
    mustKnowItems: normalizeMustKnowItems(structured?.mustKnowItems),
    singleRoomSurchargeDisplayText: structured?.singleRoomSurchargeDisplayText ?? null,
    singleRoomSurchargeAmount: structured?.singleRoomSurchargeAmount ?? null,
    singleRoomSurchargeCurrency: structured?.singleRoomSurchargeCurrency ?? null,
    minimumDepartureCount: structured?.minimumDepartureCount ?? travelProduct.minimumDepartureCount ?? null,
    minimumDepartureText: structured?.minimumDepartureText ?? travelProduct.minimumDepartureText ?? null,
    isDepartureGuaranteed: structured?.isDepartureGuaranteed ?? travelProduct.isDepartureGuaranteed ?? null,
    currentBookedCount: structured?.currentBookedCount ?? travelProduct.currentBookedCount ?? null,
    remainingSeatsCount: structured?.remainingSeatsCount ?? null,
    departureStatusText: structured?.departureStatusText ?? travelProduct.departureStatusText ?? null,
    meetingInfoRaw: meetingPublic.meetingInfoRaw,
    meetingPlaceRaw: meetingPublic.meetingPlaceRaw,
    meetingFallbackText: meetingPublic.meetingFallbackText,
    flightExposurePolicy:
      flightDisplayPolicy === 'legacy_parsed'
        ? parsedFlightExposurePolicy ?? 'public_full'
        : flightDisplayPolicy === 'suppress_no_parsed'
          ? 'admin_only'
          : 'public_full',
    flightManualCorrection,
    applyFlightManualCorrectionOverlay: publicFlightManualModule.flightManualCorrectionHasActiveFinal(
      flightManualCorrection
    ),
    primaryDestination: travelProduct.primaryDestination ?? null,
    listingKind: travelProduct.listingKind ?? null,
    infantAgeRuleText: structured?.infantAgeRuleText ?? null,
    childAgeRuleText: structured?.childAgeRuleText ?? null,
    bgImageSource: travelProduct.bgImageSource ?? null,
    bgImageIsGenerated: travelProduct.bgImageIsGenerated ?? false,
    /** schedule 캡션 없을 때 image_assets(public_url 일치) seo_title/title/alt 로 히어로 보강 */
    heroCoverCaptionFromAsset,
    ...(useModetourPriceMergeContext
      ? {
          modetourStickyLocalPayLine: formatModetourStickyLocalPayPerPersonLine(
            travelProduct.mandatoryLocalFee ?? null,
            travelProduct.mandatoryCurrency ?? null
          ),
        }
      : {}),
  }
  assertNoInternalMetaLeak(serialized, '/products/[id]')

  const viewProduct = tryApplyVerygoodPublicProductSerializedPatch(publicConsumptionModuleKey, serialized)

  const ybtourDetailProduct =
    publicConsumptionModuleKey === 'ybtour'
      ? { ...viewProduct, ybtourFlightStructuredForHero: ybtourFlightStructuredForHeroPublic }
      : null

  const detailMobile =
    publicConsumptionModuleKey === 'verygoodtour' ? (
      <VerygoodMobileProductDetail product={viewProduct} />
    ) : publicConsumptionModuleKey === 'ybtour' && ybtourDetailProduct ? (
      <YbtourMobileProductDetail product={ybtourDetailProduct} />
    ) : (
      <MobileProductDetail product={serialized} />
    )

  const detailDesktop =
    publicConsumptionModuleKey === 'verygoodtour' ? (
      <VerygoodTravelProductDetail product={viewProduct} />
    ) : publicConsumptionModuleKey === 'ybtour' && ybtourDetailProduct ? (
      <YbtourTravelProductDetail product={ybtourDetailProduct} />
    ) : (
      <TravelProductDetail product={serialized} />
    )

  return (
    <>
      <ProductJsonLd
        productId={travelProduct.id}
        name={travelProduct.title ?? ''}
        description={seoProductDescription}
        imageUrl={seoCoverUrl}
      />
      <ProductDetailCopyGuard>
        <div className="md:hidden">
          <Header />
          {detailMobile}
        </div>
        <div className="hidden md:block">{detailDesktop}</div>
      </ProductDetailCopyGuard>
    </>
  )
}
