import type { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { PRODUCT_BROWSE_FULL_INCLUDE, type ProductBrowseIncludedRow } from '@/lib/product-browse-full-include'
import { computeEffectivePricePerPersonKrwFromRow } from '@/lib/product-price-per-person'
import { filterProductsForOverseasDestinationTree } from '@/lib/active-overseas-location-tree'
import { filterProductsForDomesticDestinationTree } from '@/lib/active-domestic-location-tree'
import { aggregateAirlineFacets, aggregateBrandFacets } from '@/lib/products-browse-facets'
import {
  computeFacetFlags,
  productRowPassesExtendedFilters,
  type ExtendedBrowseFilters,
  type ProductBrowseFullRow,
} from '@/lib/products-browse-extended-filter'
import { parseBrowseQuery } from '@/lib/products-browse-query'
import {
  scoreAndFilterProducts,
  type ProductBrowseType,
  type BrowseSort,
} from '@/lib/products-browse-filter'
import { destinationTermsFromQuery } from '@/lib/top-nav-resolve'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { buildCaptionLookupMapFromPublicUrls, lookupCaptionFromMap } from '@/lib/image-asset-public-caption'
import { resolvePublicImageSourceUserLabel } from '@/lib/public-image-overlay-ssot'
import { resolvePublicProductHeroSeoKeywordOverlay } from '@/lib/public-product-hero-seo-keyword'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import {
  browseRegionToDbContinents,
  resolveBrowseCountryParamToCountryKeySlugs,
  resolveBrowseCountryParamToDbCountries,
  resolveChinaSubregionDbCityKeywords,
  resolveJapanSubregionDbCityKeywords,
} from '@/lib/browse-country-url-resolve'
import {
  prismaWhereCityMasterOrTagWithLegacyNull,
  prismaWhereContinentMasterOrTagWithLegacyNull,
  prismaWhereCountryTreeKeyOrTagWithLegacyNull,
} from '@/lib/browse-master-geo'
import { resolveOverseasDisplayBucketForBrowse } from '@/lib/overseas-display-buckets'
import { filterPoolByStoredTravelScope } from '@/lib/travel-scope-pool-filter'
import { parseListingKind } from '@/lib/product-listing-kind'
import {
  domesticDisplayCategoryIsSpecialTheme,
  domesticNavRegionProductMatches,
  domesticProductMatchesBus,
  domesticProductMatchesScheduleNavKey,
  domesticProductMatchesShip,
  domesticProductMatchesTrain,
} from '@/lib/domestic-public-browse-match'

export const dynamic = 'force-dynamic'

/** 4xx 등 클라이언트 오류 — unstable_cache 밖에서 Response 생성 (캐시하지 않음) */
class BrowseRouteClientError extends Error {
  constructor(
    public readonly guardContext: string,
    public readonly body: unknown,
    public readonly status: number,
  ) {
    super(guardContext)
    this.name = 'BrowseRouteClientError'
  }
}

/** 메가메뉴 탭 id → `Product.localDepartureTag` 배열 원소 (Prisma `has`) */
function localDepartureTagForBrowseRegion(region: string | null | undefined): 'busan' | 'cheongju' | 'daegu' | null {
  const t = (region ?? '').trim().toLowerCase()
  if (t === 'busan_dep') return 'busan'
  if (t === 'cheongju_dep') return 'cheongju'
  if (t === 'daegu_dep') return 'daegu'
  return null
}

function displayNameFromImageUrl(url: string | null | undefined): string | null {
  const raw = (url ?? '').trim()
  if (!raw) return null
  const noQuery = raw.split('?')[0] ?? raw
  const base = noQuery.split('/').pop() ?? noQuery
  const noExt = base.replace(/\.[a-z0-9]{2,5}$/i, '')
  const cleaned = noExt
    .replace(/[_-]+/g, ' ')
    .replace(/\b(day|d)\s*\d{1,2}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  if (/^day\s*\d{1,2}$/i.test(cleaned)) return null
  return cleaned
}

function parseBrowseType(raw: string | null): ProductBrowseType | null {
  if (!raw) return null
  const u = raw.toLowerCase().trim()
  if (u === 'free') return 'airtel'
  if (u === 'travel' || u === 'semi' || u === 'private' || u === 'airtel') return u
  return null
}

function parseSort(raw: string | null): BrowseSort {
  const u = (raw ?? 'popular').toLowerCase().trim()
  if (u === 'budget_fit' || u === 'price_asc' || u === 'price_desc' || u === 'popular' || u === 'departure_asc')
    return u
  return 'popular'
}

function appendSubregionCityOrDestinationOr(
  overseasGeoAnd: Prisma.ProductWhereInput[],
  keywords: string[],
) {
  const orParts: Prisma.ProductWhereInput[] = [{ city: { in: keywords } }]
  for (const lab of keywords) {
    orParts.push({ destination: { contains: lab } })
    orParts.push({ destinationRaw: { contains: lab } })
    orParts.push({ primaryDestination: { contains: lab } })
  }
  overseasGeoAnd.push({ OR: orParts })
}

/**
 * GET /api/products/browse
 *
 * 예산 필터는 등록된 상품의 실제 금액을 확인하여 예산 범위 내 상품만 노출한다.
 * (priceFrom / 출발별 adultPrice / 레거시 adult 중 최소 = 인당 유효가)
 */
/** PERF-LOG: 측정 후 제거 — GET Server-Timing용 (응답 본문 변경 없음) */
let browsePerfLastPhases: {
  parseMs: number
  dbMs: number
  filterMs: number
  scoreMs: number
  mapMs: number
  rowCount: number
  finalCount: number
  cacheKey: string
} | null = null

/** 성공 JSON 본문만 반환 — 실패는 throw (unstable_cache가 500 Response를 캐시하지 않도록). */
async function productsBrowseBuildPayload(queryKey: string) {
  const perf = process.env.BONGTOUR_PERF_LOG === '1' ? { t0: performance.now(), parse: 0, db: 0, filter: 0, score: 0, map: 0, rowCount: 0, finalCount: 0 } : null // PERF-LOG: 측정 후 제거
  const searchParams = new URLSearchParams(queryKey)
    const q = parseBrowseQuery(searchParams)

    const typeParam = searchParams.get('type')
    const sort = parseSort(searchParams.get('sort'))
    const region = searchParams.get('region')
    const country = searchParams.get('country')
    const destination = searchParams.get('destination')?.trim() || null
    const city = searchParams.get('city')?.trim() || destination
    const scope = searchParams.get('scope')
    const hasOverseasUrlGeo =
      scope !== 'domestic' &&
      Boolean((region ?? '').trim() || (country ?? '').trim() || (city ?? '').trim())
    const overseasGeoAnd: Prisma.ProductWhereInput[] = []
    if (hasOverseasUrlGeo) {
      const r = (region ?? '').trim()
      const c = (country ?? '').trim()
      const ct = (city ?? '').trim()
      const localDepTag = localDepartureTagForBrowseRegion(r)
      if (localDepTag) {
        overseasGeoAnd.push({ localDepartureTag: { has: localDepTag } })
      }
      const continentList = browseRegionToDbContinents(r)

      if (r && !c) {
        if (continentList.length === 1)
          overseasGeoAnd.push(prismaWhereContinentMasterOrTagWithLegacyNull([continentList[0]!]))
        else if (continentList.length > 1)
          overseasGeoAnd.push(prismaWhereContinentMasterOrTagWithLegacyNull(continentList))
      } else if (r && c) {
        if (continentList.length === 1)
          overseasGeoAnd.push(prismaWhereContinentMasterOrTagWithLegacyNull([continentList[0]!]))
        else if (continentList.length > 1)
          overseasGeoAnd.push(prismaWhereContinentMasterOrTagWithLegacyNull(continentList))
        overseasGeoAnd.push(prismaWhereCountryTreeKeyOrTagWithLegacyNull(c))
      } else if (!r && c) {
        overseasGeoAnd.push(prismaWhereCountryTreeKeyOrTagWithLegacyNull(c))
      }
      if (ct) {
        overseasGeoAnd.push(await prismaWhereCityMasterOrTagWithLegacyNull(c, ct))
      }
    }

    const regionTrim = (region ?? '').trim()
    const countryTrim = (country ?? '').trim()
    const continentListForSubfilters = browseRegionToDbContinents(regionTrim)

    if (continentListForSubfilters.includes('japan') && countryTrim) {
      const jpKw = resolveJapanSubregionDbCityKeywords(countryTrim)
      if (jpKw?.length) appendSubregionCityOrDestinationOr(overseasGeoAnd, jpKw)
    }

    if (
      (continentListForSubfilters.includes('china-mongolia-ca') ||
        continentListForSubfilters.includes('hongkong-macau')) &&
      countryTrim
    ) {
      const dbs = resolveBrowseCountryParamToDbCountries(countryTrim)
      if (dbs.length === 1 && dbs[0] === '중국') {
        const cnKw = resolveChinaSubregionDbCityKeywords(countryTrim)
        if (cnKw?.length) appendSubregionCityOrDestinationOr(overseasGeoAnd, cnKw)
      }
    }

    const seasonCountriesRaw = (searchParams.get('seasonCountries') ?? '').trim()
    const seasonCountrySlugs = seasonCountriesRaw
      ? seasonCountriesRaw
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : []
    if ((scope ?? '').trim().toLowerCase() !== 'domestic' && seasonCountrySlugs.length > 0) {
      const seasonDbCountries = [
        ...new Set(seasonCountrySlugs.flatMap((s) => resolveBrowseCountryParamToDbCountries(s))),
      ]
      const seasonKeySlugs = [
        ...new Set(seasonCountrySlugs.flatMap((s) => resolveBrowseCountryParamToCountryKeySlugs(s))),
      ]
      if (seasonDbCountries.length === 0) {
        overseasGeoAnd.push({ country: { in: [] } })
      } else if (seasonDbCountries.length === 1) {
        const primary = { country: seasonDbCountries[0]! }
        if (seasonKeySlugs.length > 0) {
          overseasGeoAnd.push({
            OR: [
              primary,
              { countryTags: { some: { countryKey: { in: seasonKeySlugs } } } },
              { countryKey: { in: seasonKeySlugs } },
            ],
          })
        } else {
          overseasGeoAnd.push(primary)
        }
      } else {
        const primary = { country: { in: seasonDbCountries } }
        if (seasonKeySlugs.length > 0) {
          overseasGeoAnd.push({
            OR: [
              primary,
              { countryTags: { some: { countryKey: { in: seasonKeySlugs } } } },
              { countryKey: { in: seasonKeySlugs } },
            ],
          })
        } else {
          overseasGeoAnd.push(primary)
        }
      }
    }

    const budgetRaw = searchParams.get('budgetPerPerson')
    const budgetPerPersonMax =
      budgetRaw != null && budgetRaw !== '' ? Math.max(0, parseInt(budgetRaw, 10)) : null
    if (budgetPerPersonMax != null && Number.isNaN(budgetPerPersonMax)) {
      throw new BrowseRouteClientError(
        'api.products.browse.budget',
        { ok: false, error: 'budgetPerPerson 형식이 올바르지 않습니다.' },
        400,
      )
    }

    const regionPref = (searchParams.get('regionPref') ?? '').trim()
    const extraTerms = regionPref
      ? regionPref
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const baseTerms = destinationTermsFromQuery(region, country, city)
    const destinationTerms = [...baseTerms, ...extraTerms]

    const dmPillar = (searchParams.get('dmPillar') ?? '').trim()
    const dmItem = (searchParams.get('dmItem') ?? '').trim()
    const domesticTransport = (searchParams.get('domesticTransport') ?? '').trim().toLowerCase()
    const domesticSpecialTheme = searchParams.get('domesticSpecialTheme') === '1'

    const tripDaysRaw = searchParams.get('tripDays')
    const tripDaysFilter =
      tripDaysRaw != null && tripDaysRaw !== '' ? parseInt(tripDaysRaw, 10) : null
    const departMonth = searchParams.get('departMonth')
    const paxRaw = searchParams.get('pax')
    const paxFilter = paxRaw != null && paxRaw !== '' ? parseInt(paxRaw, 10) : null

    const page = q.page
    const scopeForLimit = searchParams.get('scope')
    const limitParam = searchParams.get('limit')
    const parsedLimit =
      limitParam != null && limitParam !== '' ? parseInt(limitParam, 10) : Number.NaN
    const rawLimit = Number.isFinite(parsedLimit) ? parsedLimit : null
    /** 클라이언트가 큰 limit을 요청해도 상한 — 응답 크기 제한 */
    const limitCap = scopeForLimit === 'overseas' || scopeForLimit === 'domestic' ? 120 : 60
    const limit = Math.min(limitCap, Math.max(1, rawLimit ?? 24))

    if (perf) perf.parse = performance.now() // PERF-LOG: 측정 후 제거

    const rows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        AND: [
          ...(overseasGeoAnd.length > 0 ? overseasGeoAnd : []),
          publicProductWhereClause(),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: PRODUCT_BROWSE_FULL_INCLUDE,
    })
    if (perf) {
      perf.db = performance.now() // PERF-LOG: 측정 후 제거
      perf.rowCount = rows.length // PERF-LOG: 측정 후 제거
    }
    /**
     * 공개 목록용으로 "예약 가능 최소일(오늘+2일) 이후" 출발만 `departures`에 남긴다.
     * 예전에는 DB에 출발 행이 하나라도 있으면서 전부 과거인 경우 상품 전체를 빼서,
     * 관리자 KPI(등록 건수)와 고객 목록이 어긋날 수 있었다. 상품은 유지하고 가격·정렬은
     * `computeEffectivePricePerPersonKrwFromRow`의 레거시 prices / priceFrom 폴백을 쓴다.
     */
    const rowsWithPublicDepartures = rows.map((p) => {
      const nextDepartures = (p.departures ?? []).filter((d) =>
        isOnOrAfterPublicBookableMinDate(d.departureDate)
      )
      return { ...p, departures: nextDepartures }
    })

    const overseasLike = scope === 'overseas' || !!region
    const domesticLike = scope === 'domestic'
    const skipGlobalTripDaysForDomesticSchedule =
      domesticLike && dmPillar === 'schedule' && dmItem.length > 0
    /** region만 있어도 해외 목적지 트리와 동일하게 travelScope 정렬 */
    const travelScopeParam = domesticLike ? 'domestic' : overseasLike ? 'overseas' : null
    const scopedBeforeTree = filterPoolByStoredTravelScope(rowsWithPublicDepartures, travelScopeParam)
    let pool: typeof rowsWithPublicDepartures = scopedBeforeTree
    if (domesticLike) {
      pool = filterProductsForDomesticDestinationTree(scopedBeforeTree)
    } else if (overseasLike) {
      pool = filterProductsForOverseasDestinationTree(scopedBeforeTree)
    }

    let filteredRows = pool
    if (tripDaysFilter != null && !Number.isNaN(tripDaysFilter) && !skipGlobalTripDaysForDomesticSchedule) {
      filteredRows = filteredRows.filter((p) => p.tripDays === tripDaysFilter)
    }
    if (paxFilter != null && !Number.isNaN(paxFilter) && paxFilter > 0) {
      filteredRows = filteredRows.filter((p) => {
        if (!Array.isArray(p.departures) || p.departures.length === 0) return true
        return p.departures.some((d) => d.minPax == null || paxFilter >= d.minPax)
      })
    }

    /** DB `Product.listingKind` 로 한정. 레거시 null 은 일반 패키지(travel)로 간주 */
    const listingKindRaw = searchParams.get('listingKind')
    const listingKindParsed = listingKindRaw ? parseListingKind(listingKindRaw) : null
    if (listingKindParsed) {
      filteredRows = filteredRows.filter((p) => {
        const lk = p.listingKind
        if (listingKindParsed === 'travel') {
          return lk === 'travel' || lk == null || lk === ''
        }
        return lk === listingKindParsed
      })
    }

    /** 국내 허브는 패키지·우리여행 중심 — 자유여행(항공+호텔)은 `/travel/air-hotel`로 분리 노출 */
    const wantsAirtelHubSlice =
      parseBrowseType(typeParam) === 'airtel' ||
      q.categories.some((c) => c === 'airtel') ||
      listingKindParsed === 'air_hotel_free'
    if (domesticLike && !wantsAirtelHubSlice) {
      filteredRows = filteredRows.filter((p) => (p.listingKind ?? '').trim() !== 'air_hotel_free')
    }

    let scoringDestinationTerms = destinationTerms
    if (hasOverseasUrlGeo) {
      scoringDestinationTerms = extraTerms.length > 0 ? [...extraTerms] : []
    }
    if (domesticLike) {
      if (domesticSpecialTheme) {
        filteredRows = filteredRows.filter((p) => domesticDisplayCategoryIsSpecialTheme(p.displayCategory))
        scoringDestinationTerms = [...baseTerms]
      } else if (domesticTransport === 'bus') {
        filteredRows = filteredRows.filter((p) => domesticProductMatchesBus(p))
        scoringDestinationTerms = [...baseTerms]
      } else if (domesticTransport === 'train') {
        filteredRows = filteredRows.filter((p) => domesticProductMatchesTrain(p))
        scoringDestinationTerms = [...baseTerms]
      } else if (domesticTransport === 'ship') {
        filteredRows = filteredRows.filter((p) => domesticProductMatchesShip(p))
        scoringDestinationTerms = [...baseTerms]
      } else if (dmPillar === 'region' && dmItem) {
        filteredRows = filteredRows.filter((p) => domesticNavRegionProductMatches(p, dmItem, extraTerms))
        scoringDestinationTerms = [...baseTerms]
      } else if (dmPillar === 'schedule' && dmItem) {
        filteredRows = filteredRows.filter((p) =>
          domesticProductMatchesScheduleNavKey(
            { title: p.title, tripDays: p.tripDays, departures: p.departures },
            dmItem,
            extraTerms
          )
        )
        scoringDestinationTerms = [...baseTerms]
      }
    }

    if (perf) perf.filter = performance.now() // PERF-LOG: 측정 후 제거

    /** 사이드바 상품유형이 있으면 1차 유형은 카테고리 필터에 맡기고 목적지만 좁힌다 */
    const browseTypeForScore: ProductBrowseType | null =
      q.categories.length > 0 ? null : parseBrowseType(typeParam)

    const effectiveSort: BrowseSort =
      budgetPerPersonMax != null && sort === 'popular'
        ? 'budget_fit'
        : sort === 'budget_fit' && budgetPerPersonMax == null
          ? 'popular'
          : sort

    const urlGeo = { region, country, city }

    const scoredForFacets = scoreAndFilterProducts(filteredRows, {
      type: browseTypeForScore,
      destinationTerms: scoringDestinationTerms,
      budgetPerPersonMax: null,
      sort: 'popular',
      urlGeo,
    })

    const facetRows = scoredForFacets.map((s) => s.product as ProductBrowseFullRow)
    const brandFacets = aggregateBrandFacets(facetRows)
    const airlineFacets = aggregateAirlineFacets(facetRows)
    const facetFlags = computeFacetFlags(facetRows)

    let scored = scoreAndFilterProducts(filteredRows, {
      type: browseTypeForScore,
      destinationTerms: scoringDestinationTerms,
      budgetPerPersonMax,
      sort: effectiveSort,
      urlGeo,
    })

    if (departMonth && /^\d{4}-\d{2}$/.test(departMonth)) {
      const monthKeyFromDate = (dt: Date) =>
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      /** 예약 가능 출발만 남기기 전 원본 행(`rows`)의 출발일로 월 매칭 — 전부 과거라도 해당 월 상품이 0건으로 사라지지 않게 함 */
      scored = scored.filter((s) => {
        const bookable = s.earliestDeparture
        if (bookable && monthKeyFromDate(bookable) === departMonth) return true
        const orig = rows.find((r) => r.id === s.product.id)
        for (const dep of orig?.departures ?? []) {
          const dt =
            dep.departureDate instanceof Date ? dep.departureDate : new Date(dep.departureDate)
          if (Number.isNaN(dt.getTime())) continue
          if (monthKeyFromDate(dt) === departMonth) return true
        }
        return false
      })
    }

    const ext: ExtendedBrowseFilters = {
      noOptionalTour: q.noOptionalTour || undefined,
      noShopping: q.noShopping || undefined,
      brandKeys: q.brands.length > 0 ? q.brands : undefined,
      productCategories: q.categories.length > 0 ? q.categories : undefined,
      airlineCodes: q.airlines.length > 0 ? q.airlines : undefined,
      departureHourBuckets: q.departHours.length > 0 ? q.departHours : undefined,
      departureWeekdays: q.departWeekdays.length > 0 ? q.departWeekdays : undefined,
      budgetMin: q.budgetMin,
      budgetMax: null,
    }

    scored = scored.filter((s) => productRowPassesExtendedFilters(s.product as ProductBrowseFullRow, ext))

    if (perf) perf.score = performance.now() // PERF-LOG: 측정 후 제거

    const total = scored.length
    const slice = scored.slice((page - 1) * limit, page * limit)
    if (perf) perf.finalCount = slice.length // PERF-LOG: 측정 후 제거

    const metaRows = slice.map(({ product: p, effectivePricePerPerson }) => {
      const scheduleRows = getScheduleFromProduct(p)
      const coverUrl = getFinalCoverImageUrl({
        bgImageUrl: p.bgImageUrl,
        scheduleDays: scheduleRows,
      })
      const firstScheduleName =
        scheduleRows.find((d) => d.imageDisplayName?.trim())?.imageDisplayName?.trim() ?? null
      return { p, effectivePricePerPerson, scheduleRows, coverUrl, firstScheduleName }
    })

    const urlsForCaptionBatch = metaRows
      .filter((m) => !m.firstScheduleName && m.coverUrl)
      .map((m) => m.coverUrl as string)
    const captionMap = await buildCaptionLookupMapFromPublicUrls(urlsForCaptionBatch)

    const items = metaRows.map(({ p: pRaw, effectivePricePerPerson, coverUrl, firstScheduleName }) => {
      const p = pRaw as ProductBrowseIncludedRow
      const seoAssetHint = lookupCaptionFromMap(captionMap, coverUrl)
      const coverImageSeoKeyword = resolvePublicProductHeroSeoKeywordOverlay({
        storedRegisterSeoKeywordsJson: p.publicImageHeroSeoKeywordsJson,
        storedRegisterSeoLine: p.publicImageHeroSeoLine,
        seoCaptionFromAsset: seoAssetHint,
        title: p.title,
        primaryDestination: p.primaryDestination,
        destination: p.destination,
        duration: p.duration,
        originSource: p.originSource ?? '',
      })
      const coverImageSourceUserLabel = resolvePublicImageSourceUserLabel({
        dbSource: p.bgImageSource,
        dbIsGenerated: p.bgImageIsGenerated,
        imageUrl: coverUrl,
      })
      return {
      coverImageDisplayName:
        firstScheduleName ??
        seoAssetHint ??
        displayNameFromImageUrl(coverUrl),
      coverImageSeoKeyword,
      coverImageSourceUserLabel,
      ...(() => {
        let hotelName: string | null = null
        let hotelGrade: string | null = null
        let roomType: string | null = null
        try {
          const info = p.airtelHotelInfoJson ? (JSON.parse(p.airtelHotelInfoJson) as Record<string, unknown>) : null
          if (info && typeof info === 'object') {
            if (typeof info.hotelName === 'string' && info.hotelName.trim()) hotelName = info.hotelName.trim()
            if (typeof info.hotelGrade === 'string' && info.hotelGrade.trim()) hotelGrade = info.hotelGrade.trim()
            if (typeof info.roomType === 'string' && info.roomType.trim()) roomType = info.roomType.trim()
          }
        } catch {
          // ignore malformed hotel json
        }
        return { hotelName, hotelGrade, roomType }
      })(),
      id: p.id,
      title: p.title,
      originSource: p.originSource,
      productType: p.productType,
      listingKind: p.listingKind ?? null,
      airportTransferType: p.airportTransferType,
      primaryDestination: p.primaryDestination,
      primaryRegion: p.primaryRegion,
      duration: p.duration,
      bgImageUrl: p.bgImageUrl,
      coverImageUrl: coverUrl,
      priceFrom: p.priceFrom,
      effectivePricePerPersonKrw: effectivePricePerPerson,
      earliestDeparture: p.departures[0]?.departureDate?.toISOString() ?? null,
      ...(scope === 'overseas' || region
        ? (() => {
            const matchInput = {
              title: p.title,
              originSource: p.originSource,
              primaryDestination: p.primaryDestination,
              destinationRaw: p.destinationRaw,
              destination: p.destination,
              primaryRegion: p.primaryRegion,
              continent: p.continent ?? null,
              country: p.country ?? null,
              city: p.city ?? null,
              countryKey: p.countryKey ?? null,
              continentKey: p.continentKey ?? null,
              cityKey: p.cityKey ?? null,
              countryTags: p.countryTags,
              cityTags: p.cityTags,
            }
            const match = matchProductToOverseasNode(matchInput)
            const overseasBucket = resolveOverseasDisplayBucketForBrowse(matchInput, match)
            const countryRowLabel =
              match?.countryLabel?.trim() || p.primaryDestination?.trim() || '기타'
            const browseCountry = (p.country ?? '').trim() || null
            return { overseasBucket, countryRowLabel, browseCountry }
          })()
        : {}),
    }
    })

    let suggestedBudgetMax: number | null = null
    if (budgetPerPersonMax != null && total === 0 && filteredRows.length > 0) {
      const priced = filteredRows
        .map((p) => ({ p, v: computeEffectivePricePerPersonKrwFromRow(p) }))
        .filter((x): x is { p: (typeof filteredRows)[0]; v: number } => x.v != null)
        .map((x) => x.v)
      if (priced.length > 0) {
        const over = priced.filter((v) => v > budgetPerPersonMax!).sort((a, b) => a - b)
        if (over.length > 0) suggestedBudgetMax = over[0]!
      }
    }

    if (perf) {
      perf.map = performance.now() // PERF-LOG: 측정 후 제거
      const { t0, parse, db, filter, score, map, rowCount, finalCount } = perf
      const phases = {
        parseMs: Math.round(parse - t0),
        dbMs: Math.round(db - parse),
        filterMs: Math.round(filter - db),
        scoreMs: Math.round(score - filter),
        mapMs: Math.round(map - score),
        rowCount,
        finalCount,
        cacheKey: `products-browse-v7|${queryKey}`,
      }
      browsePerfLastPhases = phases // PERF-LOG: 측정 후 제거
      console.log('[browse-perf]', JSON.stringify({ cacheHit: false, ...phases })) // PERF-LOG: 측정 후 제거
    }

    return {
      ok: true as const,
      total,
      page,
      limit,
      items,
      destinationTerms: scoringDestinationTerms,
      suggestedBudgetMax,
      facets: {
        brands: brandFacets,
        airlines: airlineFacets,
        hasDepartureTimeData: facetFlags.hasDepartureTimeData,
        hasWeekdayData: facetFlags.hasWeekdayData,
      },
      queryEcho: {
        type: typeParam,
        categories: q.categories,
        region,
        country,
        city,
      },
    }
}

function browseErrorBodyFromQueryKey(queryKey: string) {
  let q: ReturnType<typeof parseBrowseQuery>
  try {
    q = parseBrowseQuery(new URLSearchParams(queryKey))
  } catch {
    throw new BrowseRouteClientError(
      'api.products.browse.bad-query',
      { ok: false, error: '요청 파라미터를 처리하지 못했습니다.' },
      400,
    )
  }
  const sp = new URLSearchParams(queryKey)
  return {
    ok: false as const,
    error: '상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    page: q.page,
    limit: q.limit,
    destinationTerms: [] as string[],
    suggestedBudgetMax: null as number | null,
    facets: {
      brands: [] as { key: string; label: string; count: number }[],
      airlines: [] as { code: string; label: string; count: number }[],
      hasDepartureTimeData: false,
      hasWeekdayData: false,
    },
    queryEcho: {
      type: sp.get('type'),
      categories: q.categories,
      region: sp.get('region'),
      country: sp.get('country'),
      city: sp.get('city'),
    },
  }
}

export async function GET(request: Request) {
  const queryKey = new URL(request.url).searchParams.toString()
  const perfGet = process.env.BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
  const tGet0 = perfGet ? performance.now() : 0 // PERF-LOG: 측정 후 제거
  const cacheKey = `products-browse-v7|${queryKey}` // PERF-LOG: 측정 후 제거
  try {
    let cacheMissRan = false // PERF-LOG: 측정 후 제거
    const payload = await unstable_cache(
      async () => {
        cacheMissRan = true // PERF-LOG: 측정 후 제거
        return productsBrowseBuildPayload(queryKey)
      },
      ['products-browse-v7', queryKey],
      { revalidate: 3600 },
    )()
    const cacheHit = !cacheMissRan // PERF-LOG: 측정 후 제거
    const res = jsonWithLeakGuard(payload, 'api.products.browse.ok') // PERF-LOG: 측정 후 제거
    if (perfGet) {
      const totalMs = Math.round(performance.now() - tGet0) // PERF-LOG: 측정 후 제거
      if (cacheHit) {
        res.headers.set('Server-Timing', `total;dur=${totalMs}, cacheHit;desc="1"`) // PERF-LOG: 측정 후 제거
        console.log(
          '[browse-perf]',
          JSON.stringify({
            cacheKey,
            cacheHit: true,
            totalMs,
            parseMs: null,
            dbMs: null,
            filterMs: null,
            scoreMs: null,
            mapMs: null,
            rowCount: null,
            finalCount: null,
          }),
        ) // PERF-LOG: 측정 후 제거
      } else if (browsePerfLastPhases) {
        const p = browsePerfLastPhases // PERF-LOG: 측정 후 제거
        res.headers.set(
          'Server-Timing',
          `parse;dur=${p.parseMs}, db;dur=${p.dbMs}, filter;dur=${p.filterMs}, score;dur=${p.scoreMs}, map;dur=${p.mapMs}, total;dur=${totalMs}`,
        ) // PERF-LOG: 측정 후 제거
      }
    }
    return res
  } catch (e) {
    if (e instanceof BrowseRouteClientError) {
      return jsonWithLeakGuard(e.body, e.guardContext, { status: e.status })
    }
    console.error('[GET /api/products/browse]', e)
    try {
      const body = browseErrorBodyFromQueryKey(queryKey)
      return jsonWithLeakGuard(body, 'api.products.browse.error', { status: 500 })
    } catch (inner) {
      if (inner instanceof BrowseRouteClientError) {
        return jsonWithLeakGuard(inner.body, inner.guardContext, { status: inner.status })
      }
      throw inner
    }
  }
}
