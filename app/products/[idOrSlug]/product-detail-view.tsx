import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import {
  sanitizeFlightStructuredBodyForPublic,
  toPublicPersistedFlightStructured,
} from '@/lib/public-flight-structured-sanitize'
import Header from '@/app/components/Header'
import TravelProductDetail from '@/app/components/travel/TravelProductDetail'
import PrivateTravelProductDetail from '@/app/components/travel/PrivateTravelProductDetail'
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
import * as priceRowsKyowontour from '@/lib/product-departure-to-price-rows-kyowontour'
import * as priceRowsLottetour from '@/lib/product-departure-to-price-rows-lottetour'
import {
  extractProductPriceTableByLabels,
  mergeProductPriceTableWithLabelExtract,
} from '@/lib/product-price-table-extract'
import { normalizeMustKnowItems, parseShoppingStopsJson } from '@/lib/public-product-extras'
import {
  pickPrimaryAirlineNameForOperationalMeeting,
  resolveOperationalMeetingDisplay,
} from '@/lib/meeting-airline-operational-ssot'
import * as publicConsumptionHanatour from '@/lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '@/lib/public-consumption-modetour'
import * as publicConsumptionVerygoodtour from '@/lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '@/lib/public-consumption-ybtour'
import * as publicConsumptionKyowontour from '@/lib/public-consumption-kyowontour'
import * as publicConsumptionLottetour from '@/lib/public-consumption-lottetour'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import {
  buildModetourDirectedDisplayFromFlightStructured,
  buildModetourDirectedDisplayFromStructuredBody,
} from '@/lib/flight-modetour-parser'
import { getProductTotalDays } from '@/lib/package-rules'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { parseFlightAdminJson, resolveFlightDisplayPolicy } from '@/lib/admin-flight-profile'
import { getFlightAdminJsonFromRawMeta } from '@/lib/raw-meta-admin-flight'
import * as flightManualHanatour from '@/lib/flight-manual-correction-hanatour'
import * as flightManualModetour from '@/lib/flight-manual-correction-modetour'
import * as flightManualVerygoodtour from '@/lib/flight-manual-correction-verygoodtour'
import * as flightManualYbtour from '@/lib/flight-manual-correction-ybtour'
import * as flightManualKyowontour from '@/lib/flight-manual-correction-kyowontour'
import * as flightManualLottetour from '@/lib/flight-manual-correction-lottetour'
import * as dayHotelHanatour from '@/lib/day-hotel-plans-hanatour'
import * as dayHotelModetour from '@/lib/day-hotel-plans-modetour'
import * as dayHotelVerygoodtour from '@/lib/day-hotel-plans-verygoodtour'
import * as dayHotelYbtour from '@/lib/day-hotel-plans-ybtour'
import * as dayHotelKyowontour from '@/lib/day-hotel-plans-kyowontour'
import * as dayHotelLottetour from '@/lib/day-hotel-plans-lottetour'
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
  sanitizeModetourPublicProductAirlineLine,
} from '@/lib/modetour-product-public-display'
import {
  formatKyowontourStickyLocalPayPerPersonLine,
  sanitizeKyowontourPublicProductAirlineLine,
} from '@/lib/kyowontour-product-public-display'
import {
  formatLottetourStickyLocalPayPerPersonLine,
  sanitizeLottetourPublicProductAirlineLine,
} from '@/lib/lottetour-product-public-display'
import { buildProductDetailDepartureKeyFacts } from '@/lib/product-detail-departure-facts'
import { parseProductDetailRawMeta } from '@/lib/product-detail-rawmeta'
import {
  mapFitMasterForItinerary,
  mergeProductDetailSchedule,
  type FitMasterWithDays,
} from '@/lib/product-detail-schedule-merge'
import { buildProductDetailSeoOffers } from '@/lib/product-detail-seo-offers'
import { formatDepartureConditionForProduct } from '@/lib/minimum-departure-extract'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import { PRODUCT_DETAIL_PAGE_INCLUDE } from '@/lib/product-detail-page-include'
import { parseCounselingNotes } from '@/lib/parsed-product-types'
import { ItineraryViewLazy } from '@/components/itinerary/ItineraryViewLazy'

export type ProductDetailViewRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_PAGE_INCLUDE }>

export type { FitMasterWithDays } from '@/lib/product-detail-schedule-merge'

export async function ProductDetailView({
  travelProduct,
  fitMaster,
  initialDepartureYmd = null,
}: {
  travelProduct: ProductDetailViewRow
  fitMaster: FitMasterWithDays | null
  initialDepartureYmd?: string | null
}) {
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
      case 'kyowontour':
        return flightManualKyowontour
      case 'lottetour':
        return flightManualLottetour
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
      case 'kyowontour':
        return dayHotelKyowontour
      case 'lottetour':
        return dayHotelLottetour
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
      case 'kyowontour':
        return priceRowsKyowontour
      case 'lottetour':
        return priceRowsLottetour
      default:
        return priceRowsHanatour
    }
  })()

  const { rawParsed, structured, finalIncludedText, finalExcludedText } = parseProductDetailRawMeta(
    travelProduct.rawMeta,
    travelProduct.includedText,
    travelProduct.excludedText
  )

  const { scheduleMerged, schedule, seoItinerary } = mergeProductDetailSchedule(travelProduct)

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
  const useKyowontourPriceMergeContext = publicConsumptionModuleKey === 'kyowontour'
  const useLottetourPriceMergeContext = publicConsumptionModuleKey === 'lottetour'
  const useKyowontourPublicFlightScrub = publicConsumptionModuleKey === 'kyowontour'
  const useLottetourPublicFlightScrub = publicConsumptionModuleKey === 'lottetour'
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
      shoppingPasteRaw:
        publicConsumptionModuleKey === 'hanatour'
          ? (structured?.shoppingPasteRaw ?? null)
          : undefined,
    }
    switch (publicConsumptionModuleKey) {
      case 'modetour':
        return publicConsumptionModetour.resolveShoppingConsumption(input)
      case 'verygoodtour':
        return publicConsumptionVerygoodtour.resolveShoppingConsumption(input)
      case 'ybtour':
        return publicConsumptionYbtour.resolveShoppingConsumption(input)
      case 'kyowontour':
        return publicConsumptionKyowontour.resolveShoppingConsumption(input)
      case 'lottetour':
        return publicConsumptionLottetour.resolveShoppingConsumption(input)
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
      case 'kyowontour':
        return publicConsumptionKyowontour.resolveOptionalToursConsumption(input)
      case 'lottetour':
        return publicConsumptionLottetour.resolveOptionalToursConsumption(input)
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
      case 'kyowontour':
        return publicConsumptionKyowontour.resolveHotelConsumption(input)
      case 'lottetour':
        return publicConsumptionLottetour.resolveHotelConsumption(input)
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

  const { departureKeyFactsByDate, departureKeyFactsByDepartureId } = buildProductDetailDepartureKeyFacts({
    departures,
    flightStructured,
    productAirline: travelProduct.airline ?? null,
    adminFlightProfile,
    flightDisplayPolicy,
    verygoodtourPublicRowFactsOnly,
    useModetourDirectedParse,
    useKyowontourPublicFlightScrub,
    useLottetourPublicFlightScrub,
  })

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

  /** 참좋은: 출발일별 성인가는 행 SSOT — 본문 표로 성인·아동 덮어쓰지 않되, 유아 단가는 본문 표로 빈 칸만 채운다 */
  const verygoodPriceTableForStickyMerge =
    verygoodtourPublicRowFactsOnly && structured?.productPriceTable
      ? {
          adultPrice: null,
          childExtraBedPrice: null,
          childNoBedPrice: null,
          infantPrice: structured.productPriceTable.infantPrice ?? null,
        }
      : productPriceTableForMerge

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
    verygoodPriceTableForStickyMerge,
    useModetourPriceMergeContext
      ? { modetourVaryingAdultChildLinkage: true }
      : useYbtourPriceMergeContext
        ? { ybtourVaryingAdultChildLinkage: true }
        : useKyowontourPriceMergeContext
          ? { kyowontourVaryingAdultChildLinkage: true }
          : useLottetourPriceMergeContext
            ? { lottetourVaryingAdultChildLinkage: true }
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
    includedText: finalIncludedText,
    excludedText: finalExcludedText,
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
      return useModetourDirectedParse
        ? sanitizeModetourPublicProductAirlineLine(raw) ?? raw
        : useKyowontourPublicFlightScrub
          ? sanitizeKyowontourPublicProductAirlineLine(raw) ?? raw
          : useLottetourPublicFlightScrub
            ? sanitizeLottetourPublicProductAirlineLine(raw) ?? raw
            : raw
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
    highlightPoints: travelProduct.highlightPoints ?? null,
    highlightPointsRaw: travelProduct.highlightPointsRaw ?? null,
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
    flightAdminJson: adminFlightRaw,
    schedule,
    // 출발일/가격 행: ProductDeparture가 있으면 SSOT(스케줄러·재수집은 출발행 기준). 없을 때만 ProductPrice 레거시 fallback.
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
    bgImagePhotographer: travelProduct.bgImagePhotographer ?? null,
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
      : useKyowontourPriceMergeContext
        ? {
            modetourStickyLocalPayLine: formatKyowontourStickyLocalPayPerPersonLine(
              travelProduct.mandatoryLocalFee ?? null,
              travelProduct.mandatoryCurrency ?? null
            ),
          }
        : useLottetourPriceMergeContext
          ? {
              modetourStickyLocalPayLine: formatLottetourStickyLocalPayPerPersonLine(
                travelProduct.mandatoryLocalFee ?? null,
                travelProduct.mandatoryCurrency ?? null
              ),
            }
          : {}),
  }
  assertNoInternalMetaLeak(serialized, '/products/[id]')

  const product = serialized

  const productType = travelProduct.productType ?? ''
  const isAirtel = productType === 'airtel'
  /** 항공+호텔 자유여행 — 패키지형 상세(히어로 우측 카드·스티키 견적) */
  const isAirHotelFreeProduct = isAirHotelFreeListingForUi(travelProduct.listingKind)
  /** Fit 예시 일정 ItineraryView — `air_hotel_free`는 패키지 상세와 동일 UI */
  const isAirtelItineraryView = productType === 'airtel' && !isAirHotelFreeProduct
  /** 일반 패키지(travel/private/semi) + air_hotel_free — TravelProductDetail + ItineraryViewPackageMain */
  const isPackageItineraryBody =
    ['travel', 'private', 'semi'].includes(productType) || isAirHotelFreeProduct
  const isPrivateOrSemi = productType === 'private' || productType === 'semi'

  if (isAirtelItineraryView) {
    const bookableRows = priceRowsForPublic.filter((r) => r.priceAdult > 0)
    const lowestAdultPrice = bookableRows.length > 0
      ? Math.min(...bookableRows.map((r) => r.priceAdult))
      : 0
    const highestAdultPrice = bookableRows.length > 0
      ? Math.max(...bookableRows.map((r) => r.priceAdult))
      : 0
    const sortedByDate = [...priceRowsForPublic].sort((a, b) => a.date.localeCompare(b.date))
    const departureDateFrom = sortedByDate[0]?.date ?? ''
    const departureDateTo = sortedByDate[sortedByDate.length - 1]?.date ?? ''
    const firstBookable = bookableRows[0]
    const minPaxFromDepartures = (() => {
      let min: number | null = null
      for (const d of departures) {
        const p = d.minPax
        if (p != null && p > 0) min = min == null ? p : Math.min(min, p)
      }
      return min
    })()
    const masterArg =
      isAirtel && fitMaster && fitMaster.status === 'published'
        ? mapFitMasterForItinerary(fitMaster)
        : null
    const computedTotalDays = getProductTotalDays(travelProduct, masterArg?.totalDays)
    const priceInfo = {
      departureDateFrom,
      departureDateTo,
      lowestAdultPrice,
      highestAdultPrice,
      infantPrice: firstBookable?.priceInfant ?? 150000,
      childBedPrice: firstBookable?.priceChildWithBed ?? lowestAdultPrice,
      minPaxPerDeparture:
        minPaxFromDepartures ??
        travelProduct.minimumDepartureCount ??
        structured?.minimumDepartureCount ??
        null,
      totalDays: computedTotalDays,
    }

    const airtelDefaultDate = priceInfo.departureDateFrom
    const airtelDefaultFacts = departureKeyFactsByDate?.[airtelDefaultDate] ?? null
    const airtelTravelCitiesLine = (() => {
      const raw = [product.primaryDestination, product.destination]
        .filter((x): x is string => Boolean(x?.trim()))
        .join(',')
      const parts = raw
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const uniq = [...new Set(parts)]
      return uniq.length ? uniq.join(', ') : product.destination?.trim() || '—'
    })()
    const airtelMeetingDefault = (() => {
      const merged = [product.meetingInfoRaw, product.meetingPlaceRaw]
        .filter((x): x is string => Boolean(x?.trim()))
        .join(' · ')
      if (merged.trim()) return merged.trim()
      const fb = product.meetingFallbackText?.trim()
      if (fb) return fb
      return '미팅장소는 상담 시 확인하여 안내드리겠습니다.'
    })()

    return (
      <>
        <Header />
        <ItineraryViewLazy
          mode="example"
          master={masterArg}
          travelCoreInfo={{
            productAirline: product.airline ?? null,
            travelCitiesLine: airtelTravelCitiesLine,
            meetingDefault: airtelMeetingDefault,
            productMetaChips: buildProductMetaChips(product, { departureFactsOverride: airtelDefaultFacts }),
            flightExposurePolicy: product.flightExposurePolicy ?? null,
            departureKeyFactsByDate: product.departureKeyFactsByDate,
            departureKeyFactsByDepartureId: product.departureKeyFactsByDepartureId,
            departureConditionLine: formatDepartureConditionForProduct(product),
            duration: product.duration,
            originSource: product.originSource,
            applyFlightManualCorrectionOverlay: product.applyFlightManualCorrectionOverlay,
            flightManualCorrection: product.flightManualCorrection ?? null,
          }}
          product={{
            id: String(product.id),
            title: product.title,
            productType,
            originSource: travelProduct.originSource ?? '',
            originCode: travelProduct.originCode ?? '',
            bgImageUrl: travelProduct.bgImageUrl ?? null,
            bgImagePhotographer: travelProduct.bgImagePhotographer ?? null,
            primaryDestination: product.primaryDestination ?? travelProduct.primaryDestination ?? null,
            schedule: product.schedule ?? null,
            bgImageSource: product.bgImageSource ?? null,
            bgImageIsGenerated: product.bgImageIsGenerated ?? null,
            bgImagePlaceName: travelProduct.bgImagePlaceName ?? null,
            bgImageRehostSearchLabel: travelProduct.bgImageRehostSearchLabel ?? null,
            heroImageSeoKeywordOverlay,
            flightStructured: product.flightStructured ?? null,
            minimumDepartureCount: product.minimumDepartureCount ?? null,
            minimumDepartureText: product.minimumDepartureText ?? null,
            hotelSummaryText: product.hotelSummaryText ?? null,
            hotelNames: product.hotelNames ?? null,
            includedText: product.includedText ?? null,
            excludedText: product.excludedText ?? null,
            optionalToursStructured: product.optionalToursStructured ?? null,
            optionalToursPasteRaw: product.optionalToursPasteRaw ?? null,
            optionalTourSummaryRaw:
              product.optionalToursPasteRaw?.trim() ||
              product.optionalTourDisplayNoticeFinal?.trim() ||
              product.optionalTourNoticeRaw?.trim() ||
              null,
            shoppingCount: product.shoppingCount ?? null,
            shoppingItems: product.shoppingItems ?? null,
            shoppingCautionNoticeRaw: product.shoppingNoticeRaw ?? null,
            airtelHotelInfoJson: travelProduct.airtelHotelInfoJson ?? null,
            flightAdminJson: adminFlightRaw,
            duration: travelProduct.duration ?? null,
            reservationNoticeRaw: product.reservationNoticeRaw ?? null,
            mustKnowItems: product.mustKnowItems ?? null,
            travelScope: travelProduct.travelScope === 'domestic' ? 'domestic' : 'overseas',
          }}
          prices={priceRowsForPublic}
          priceInfo={priceInfo}
        />
      </>
    )
  }

  if (isPackageItineraryBody) {
    assertNoInternalMetaLeak(serialized, '/products/[id] package-itinerary')
  }

  const viewProduct = tryApplyVerygoodPublicProductSerializedPatch(publicConsumptionModuleKey, serialized)

  const ybtourDetailProduct =
    publicConsumptionModuleKey === 'ybtour'
      ? { ...viewProduct, ybtourFlightStructuredForHero: ybtourFlightStructuredForHeroPublic }
      : null

  const showEsimCrossSell = travelProduct.travelScope === 'overseas'

  const packageDetailMobile = (
    <MobileProductDetail
      product={serialized}
      showEsimCrossSell={showEsimCrossSell}
      initialDepartureYmd={initialDepartureYmd}
    />
  )
  const packageDetailDesktop = isPrivateOrSemi ? (
    <PrivateTravelProductDetail product={serialized} showEsimCrossSell={showEsimCrossSell} />
  ) : (
    <TravelProductDetail
      product={serialized}
      showEsimCrossSell={showEsimCrossSell}
      initialDepartureYmd={initialDepartureYmd}
    />
  )

  const detailMobile = isPackageItineraryBody
    ? packageDetailMobile
    : publicConsumptionModuleKey === 'verygoodtour' ? (
        <VerygoodMobileProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : publicConsumptionModuleKey === 'ybtour' && ybtourDetailProduct ? (
        <YbtourMobileProductDetail product={ybtourDetailProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : (
        packageDetailMobile
      )

  const detailDesktop = isPackageItineraryBody
    ? packageDetailDesktop
    : publicConsumptionModuleKey === 'verygoodtour' ? (
        <VerygoodTravelProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : publicConsumptionModuleKey === 'ybtour' && ybtourDetailProduct ? (
        <YbtourTravelProductDetail product={ybtourDetailProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : (
        packageDetailDesktop
      )

  const seoOffers = buildProductDetailSeoOffers(departures, resolvedPriceFrom)

  const travelScopeLabel =
    travelProduct.travelScope === 'overseas'
      ? '해외여행'
      : travelProduct.travelScope === 'domestic'
        ? '국내여행'
        : null
  const travelScopeHref =
    travelProduct.travelScope === 'overseas' ? '/travel/overseas' : '/products'

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
