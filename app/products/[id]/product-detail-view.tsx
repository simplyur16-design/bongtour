import Link from 'next/link'
import type { ItineraryDay } from '@prisma/client'
import type { Prisma } from '@prisma/client'
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
  buildDepartureKeyFactsByDepartureId,
  buildDepartureKeyFactsMap,
  enrichDepartureKeyFactsMapForDisplay,
  mergeAdminDepartureFactsWithParsedLegs,
} from '@/lib/departure-key-facts'
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
import { getPriceAdult } from '@/lib/price-utils'
import { pickVerygoodPublicDefaultDepartureRow } from '@/lib/verygood/verygood-public-default-departure'
import { verygoodDurationLabelFromDepartureAtPair } from '@/lib/verygood/verygood-selected-row-trip-display'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { brandKeyResolvesToYbtour } from '@/lib/overseas-supplier-canonical-keys'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import { tryApplyVerygoodPublicProductSerializedPatch } from '@/lib/verygood-public-product-detail-patch'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { tryCaptionFromPublicImageUrl } from '@/lib/image-asset-public-caption'
import { resolvePublicProductHeroSeoKeywordOverlay } from '@/lib/public-product-hero-seo-keyword'
import ProductJsonLd, {
  type ProductJsonLdAggregateOffer,
  type ProductJsonLdItineraryItem,
} from '@/app/components/seo/ProductJsonLd'
import ProductDetailCopyGuard from '@/app/components/travel/ProductDetailCopyGuard'
import {
  absoluteUrl,
  buildPublicProductDescription,
  toAbsoluteImageUrl,
} from '@/lib/site-metadata'
import {
  formatModetourStickyLocalPayPerPersonLine,
  sanitizeModetourPublicDepartureKeyFacts,
  sanitizeModetourPublicProductAirlineLine,
} from '@/lib/modetour-product-public-display'
import { PRODUCT_DETAIL_PAGE_INCLUDE } from '@/lib/product-detail-page-include'
import { parseCounselingNotes } from '@/lib/parsed-product-types'

export type ProductDetailViewRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_PAGE_INCLUDE }>

function itineraryDayMetaByDay(days: ItineraryDay[]): Map<number, ItineraryDay> {
  const m = new Map<number, ItineraryDay>()
  for (const d of days) {
    const k = Math.floor(Number(d.day))
    if (Number.isFinite(k) && k >= 1) m.set(k, d)
  }
  return m
}

function coalesceItineraryOrScheduleText(
  db: string | null | undefined,
  fromScheduleJson: string | null | undefined
): string | null {
  const a = typeof db === 'string' ? db.trim() : ''
  if (a) return a
  const b = typeof fromScheduleJson === 'string' ? fromScheduleJson.trim() : ''
  return b || null
}

export async function ProductDetailView({ travelProduct }: { travelProduct: ProductDetailViewRow }) {
  const isAdminDraftPreview = travelProduct.registrationStatus !== 'registered'

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

  const itineraryDaysList = travelProduct.itineraryDays ?? []
  const scheduleArr = getScheduleFromProduct(travelProduct)
  const dayMeta = itineraryDayMetaByDay(itineraryDaysList)
  const scheduleMergedBase =
    scheduleArr.length > 0
      ? scheduleArr.map((s) => {
          const sk = Math.floor(Number(s.day))
          const iday = Number.isFinite(sk) && sk >= 1 ? dayMeta.get(sk) : undefined
          /** ItineraryDay가 비어 있으면 Product.schedule JSON에 넣어 둔 식사·숙소(모두투어 confirm)로 보조 */
          return {
            ...s,
            city: iday?.city?.trim() || null,
            hotelText: coalesceItineraryOrScheduleText(iday?.hotelText, s.hotelText),
            breakfastText: coalesceItineraryOrScheduleText(iday?.breakfastText, s.breakfastText),
            lunchText: coalesceItineraryOrScheduleText(iday?.lunchText, s.lunchText),
            dinnerText: coalesceItineraryOrScheduleText(iday?.dinnerText, s.dinnerText),
            mealSummaryText: coalesceItineraryOrScheduleText(iday?.mealSummaryText, s.mealSummaryText),
            meals: coalesceItineraryOrScheduleText(iday?.meals, s.meals),
          }
        })
      : []
  const scheduleMerged = scheduleMergedBase
  const seoItinerary: ProductJsonLdItineraryItem[] =
    scheduleMerged.length > 0
      ? scheduleMerged.flatMap((s, idx) => {
          const rawDay = Number(s.day)
          const dayNum = Number.isFinite(rawDay) && rawDay >= 1 ? Math.floor(rawDay) : idx + 1
          const fromTitle = typeof s.title === 'string' ? s.title.trim() : ''
          const descFirst =
            typeof s.description === 'string'
              ? (s.description
                  .trim()
                  .split(/\r?\n/)
                  .find((ln) => ln.trim().length > 0) ?? ''
                ).trim()
              : ''
          const title = (fromTitle || descFirst || `제${dayNum}일`).slice(0, 240).trim()
          if (!title) return []
          const cityField = (s as { city?: string | null }).city
          const city: string | null =
            typeof cityField === 'string' && cityField.trim() ? cityField.trim() : null
          const row: ProductJsonLdItineraryItem = { dayNumber: dayNum, title, city }
          return [row]
        })
      : []
  const schedule = scheduleMerged.length > 0 ? scheduleMerged : null

  const seoCoverUrl = getFinalCoverImageUrl({
    bgImageUrl: travelProduct.bgImageUrl,
    scheduleDays: scheduleMerged.length > 0 ? scheduleMerged : null,
  })
  const heroCoverCaptionFromAsset = await tryCaptionFromPublicImageUrl(seoCoverUrl)
  const heroImageSeoKeywordOverlay = resolvePublicProductHeroSeoKeywordOverlay({
    storedRegisterSeoKeywordsJson: travelProduct.publicImageHeroSeoKeywordsJson,
    storedRegisterSeoLine: travelProduct.publicImageHeroSeoLine,
    seoCaptionFromAsset: heroCoverCaptionFromAsset,
    title: travelProduct.title ?? '',
    primaryDestination: travelProduct.primaryDestination,
    destination: travelProduct.destination,
    duration: travelProduct.duration ?? null,
    originSource: travelProduct.originSource ?? '',
  })
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
    brandKeyResolvesToYbtour(travelProduct.brand?.brandKey) ||
    brandKeyResolvesToYbtour(
      typeof flightStructuredDebug?.supplierBrandKey === 'string'
        ? flightStructuredDebug.supplierBrandKey
        : null
    ) ||
    normalizeSupplierOrigin(travelProduct.originSource) === 'ybtour'
  const ybtourFlightStructuredForHeroPublic = useYbtourHeroFlight
    ? toPublicPersistedFlightStructured(modetourPersistedFlightStructured)
    : null
  /** 가격 병합 보정도 동일 조건에서만 활성(다른 공급사에는 미적용) */
  const useModetourPriceMergeContext = useModetourDirectedParse
  const useYbtourPriceMergeContext = publicConsumptionModuleKey === 'ybtour'
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
  const verygoodtourPublicRowFactsOnly =
    travelProduct.brand?.brandKey === 'verygoodtour' ||
    flightStructuredDebug?.supplierBrandKey === 'verygoodtour'

  const baseFactsByDate = departures.length > 0 ? buildDepartureKeyFactsMap(departures) : {}
  const departureKeyFactsByDepartureId =
    departures.length > 0 ? buildDepartureKeyFactsByDepartureId(departures) : undefined
  const parsedFactsByDate =
    departures.length > 0
      ? verygoodtourPublicRowFactsOnly
        ? baseFactsByDate
        : enrichDepartureKeyFactsMapForDisplay(
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
    verygoodtourPublicRowFactsOnly ? null : productPriceTableForMerge,
    useModetourPriceMergeContext
      ? { modetourVaryingAdultChildLinkage: true }
      : useYbtourPriceMergeContext
        ? { ybtourVaryingAdultChildLinkage: true }
        : undefined
  )
  const priceRowsForPublic = Array.isArray(mergedPriceRows) ? mergedPriceRows : []

  const verygoodPublicRepRow =
    verygoodtourPublicRowFactsOnly && priceRowsForPublic.length > 0
      ? pickVerygoodPublicDefaultDepartureRow(
          priceRowsForPublic as Array<{ date: string; id: string; status?: string }>
        )
      : null
  const verygoodPublicRepCarrier =
    verygoodPublicRepRow && departures.length > 0
      ? departures.find((d) => String(d.id) === String(verygoodPublicRepRow.id))?.carrierName?.trim() ?? null
      : null
  const verygoodPublicRepDeparture =
    verygoodtourPublicRowFactsOnly && verygoodPublicRepRow && departures.length > 0
      ? departures.find((d) => String(d.id) === String(verygoodPublicRepRow.id)) ?? null
      : null
  const verygoodPublicDurationFromRepRow =
    verygoodPublicRepDeparture != null
      ? verygoodDurationLabelFromDepartureAtPair(
          verygoodPublicRepDeparture.outboundDepartureAt,
          verygoodPublicRepDeparture.inboundArrivalAt
        )
      : null
  const verygoodPublicPriceFromRepRow =
    verygoodPublicRepRow != null ? getPriceAdult(verygoodPublicRepRow as never) : null

  const resolvedPriceFrom =
    verygoodtourPublicRowFactsOnly && verygoodPublicPriceFromRepRow != null && verygoodPublicPriceFromRepRow > 0
      ? verygoodPublicPriceFromRepRow
      : travelProduct.priceFrom ?? null

  const meetingPublic = resolveOperationalMeetingDisplay(
    pickPrimaryAirlineNameForOperationalMeeting({
      departureCarrierFirst:
        verygoodtourPublicRowFactsOnly && verygoodPublicRepDeparture?.carrierName?.trim()
          ? verygoodPublicRepDeparture.carrierName.trim()
          : departures[0]?.carrierName ?? null,
      structuredAirlineName: (structured?.airlineName as string | undefined) ?? null,
      productAirline: travelProduct.airline ?? null,
    })
  )

  const serialized: TravelProduct = {
    ...productForDetail,
    airline: (() => {
      const vgPublic =
        verygoodtourPublicRowFactsOnly &&
        flightDisplayPolicy !== 'admin_only' &&
        flightDisplayPolicy !== 'suppress_no_parsed'
      const raw = (() => {
        if (!vgPublic) return travelProduct.airline ?? null
        if (verygoodPublicRepCarrier) return verygoodPublicRepCarrier
        return travelProduct.airline ?? null
      })()
      return useModetourDirectedParse ? sanitizeModetourPublicProductAirlineLine(raw) ?? raw : raw
    })(),
    destination: travelProduct.destination ?? '',
    title: travelProduct.title ?? '',
    duration:
      verygoodtourPublicRowFactsOnly && verygoodPublicDurationFromRepRow
        ? verygoodPublicDurationFromRepRow
        : travelProduct.duration ?? '',
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
    priceFrom: resolvedPriceFrom,
    priceCurrency: travelProduct.priceCurrency ?? null,
    departureKeyFactsByDate,
    departureKeyFactsByDepartureId,
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
    /** 히어로 이미지 내부 좌측 SEO 키워드 전용(캡션 파이프라인과 분리) */
    heroImageSeoKeywordOverlay,
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

  const pricedDepartures = departures.filter((d) => d.adultPrice != null && d.adultPrice > 0)
  const isUnavailable = (d: (typeof departures)[number]) => {
    const sold =
      (d.statusRaw ?? '').includes('마감') || (d.seatsStatusRaw ?? '').includes('마감')
    return sold
  }
  const unavailableCount = departures.filter(isUnavailable).length
  const totalCount = departures.length

  const formatYmd = (d: Date) => d.toISOString().slice(0, 10)

  let seoOffers: ProductJsonLdAggregateOffer | null = null
  if (pricedDepartures.length > 0) {
    const prices = pricedDepartures.map((d) => d.adultPrice as number)
    const dates = pricedDepartures.map((d) => d.departureDate).sort((a, b) => +a - +b)

    let availability: 'InStock' | 'LimitedAvailability' | 'SoldOut' = 'InStock'
    if (totalCount > 0 && unavailableCount === totalCount) availability = 'SoldOut'
    else if (totalCount > 0 && unavailableCount * 2 >= totalCount) availability = 'LimitedAvailability'

    seoOffers = {
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: pricedDepartures.length,
      availability,
      validFrom: formatYmd(dates[0]),
      priceValidUntil: formatYmd(dates[dates.length - 1]),
    }
  } else if (resolvedPriceFrom != null && resolvedPriceFrom > 0) {
    seoOffers = {
      lowPrice: resolvedPriceFrom,
      highPrice: resolvedPriceFrom,
      offerCount: 0,
      availability: 'OutOfStock',
    }
  }

  const travelScopeLabel =
    travelProduct.travelScope === 'overseas'
      ? '해외여행'
      : travelProduct.travelScope === 'domestic'
        ? '국내여행'
        : null
  const travelScopeHref =
    travelProduct.travelScope === 'overseas'
      ? '/travel/overseas'
      : travelProduct.travelScope === 'domestic'
        ? '/travel/domestic'
        : '/products'

  const seoBreadcrumbItems = [
    { position: 1, name: '홈', item: absoluteUrl('/') },
    ...(travelScopeLabel
      ? [{ position: 2, name: travelScopeLabel, item: absoluteUrl(travelScopeHref) }]
      : []),
    { position: travelScopeLabel ? 3 : 2, name: travelProduct.title ?? '상품' },
  ]

  return (
    <>
      {travelProduct.registrationStatus === 'registered' ? (
        <ProductJsonLd
          productId={travelProduct.id}
          name={travelProduct.title ?? ''}
          description={seoProductDescription}
          imageUrl={seoCoverUrl}
          offers={seoOffers}
          breadcrumbItems={seoBreadcrumbItems}
          itinerary={seoItinerary.length > 0 ? seoItinerary : null}
        />
      ) : null}
      <ProductDetailCopyGuard>
        {isAdminDraftPreview ? (
          <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
            관리자 미리보기 · 등록 확정 전 상품입니다. 일반 사용자에게는 표시되지 않습니다.
            <Link href="/admin/pending" className="ml-2 underline">
              등록대기
            </Link>
          </div>
        ) : null}
        <div className="md:hidden">
          <Header />
          {detailMobile}
        </div>
        <div className="hidden md:block">{detailDesktop}</div>
      </ProductDetailCopyGuard>
    </>
  )
}
