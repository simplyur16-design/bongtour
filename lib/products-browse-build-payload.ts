import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  attachBrowseDeparturesToProducts,
  buildProductBrowseFindManySelectWithoutDepartures,
  fetchBrowseDeparturesByProductIds,
  fetchProductBrowseScheduleByIds,
  fetchProductIdsWithDepartureInCalendarMonth,
  productBrowseRowsWithEmptyDepartures,
  type ProductBrowseIncludedRow,
} from '@/lib/product-browse-full-include'
import { minBrowseBookableAdultPrice } from '@/lib/browse-product-seat-bookable'
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
import { airportTransferTypeForListingKind } from '@/lib/airport-transfer-infer'
import { buildCaptionLookupMapFromPublicUrls, lookupCaptionFromMap } from '@/lib/image-asset-public-caption'
import { resolvePublicImageSourceUserLabel } from '@/lib/public-image-overlay-ssot'
import { resolvePublicProductHeroSeoKeywordOverlay } from '@/lib/public-product-hero-seo-keyword'
import { toSeoulYmd } from '@/lib/public-bookable-date'
import { departureDateToYmd } from '@/lib/modetour-urgent-deal'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { resolveProductListDestinationLabel } from '@/lib/verygoodtour-listing-title-from-paste'
import {
  resolveBrowseCountryParamToCountryKeySlugs,
  resolveBrowseCountryParamToDbCountries,
} from '@/lib/browse-country-url-resolve'
import {
  buildOverseasBrowseGeoResolution,
  prismaWhereProductCountryTagKeysIn,
  resolveBrowseRegionToCountryKeys,
} from '@/lib/browse-master-geo'
import { productMatchesBrowseRegionTab } from '@/lib/browse-region-tab-match'
import {
  localDepartureTagForBrowseRegion,
  sportsThemeTagForBrowseRegion,
} from '@/lib/browse-master-geo-continents'
import { SPORTS_THEME_TAG_VALUES, type SportsThemeTag } from '@/lib/product-listing-kind'
import {
  resolveOverseasCountryRowLabelForBrowse,
  resolveOverseasDisplayBucketForBrowse,
} from '@/lib/overseas-display-buckets'
import {
  isMegaMenuRegionCityGroupTabId,
  resolveOverseasMegaMenuSubgroupLabelForBrowse,
  resolveOverseasMegaMenuSubgroupLabelFromCountryRow,
} from '@/lib/overseas-mega-region-city-group'
import { resolveBrowseMegaRegionTabIdForBrowse } from '@/lib/browse-mega-region-tab-id'
import { buildBrowseItemFilterMeta } from '@/lib/products-browse-client-sidebar'
import { isOverseasHubFullCatalogQueryKey } from '@/lib/products-browse-hub-query'
import {
  filterPoolByStoredTravelScope,
  prismaWhereForBrowseTravelScope,
} from '@/lib/travel-scope-pool-filter'
import { prismaWhereClausesForBrowseListingSlice } from '@/lib/products-browse-db-where'
import {
  AIR_HOTEL_BROWSE_TYPE,
  isAirHotelBrowseCategoryToken,
  isAirHotelProduct,
  parseAirHotelBrowseTypeParam,
} from '@/lib/air-hotel-product-ssot'
import { parseListingKind } from '@/lib/product-listing-kind'
import {
  domesticDisplayCategoryIsSpecialTheme,
  domesticNavRegionProductMatches,
  domesticProductMatchesBus,
  domesticProductMatchesScheduleNavKey,
  domesticProductMatchesShip,
  domesticProductMatchesTrain,
} from '@/lib/domestic-public-browse-match'

function normalizeSportsThemeTagsForBrowse(raw: string[] | null | undefined): SportsThemeTag[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const set = new Set(raw.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean))
  return SPORTS_THEME_TAG_VALUES.filter((k) => set.has(k))
}

/** 4xx 등 클라이언트 오류 — unstable_cache 밖에서 Response 생성 (캐시하지 않음) */
export class BrowseRouteClientError extends Error {
  constructor(
    public readonly guardContext: string,
    public readonly body: unknown,
    public readonly status: number,
  ) {
    super(guardContext)
    this.name = 'BrowseRouteClientError'
  }
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
  return parseAirHotelBrowseTypeParam(raw)
}

function parseSort(raw: string | null): BrowseSort {
  const u = (raw ?? 'popular').toLowerCase().trim()
  if (u === 'budget_fit' || u === 'price_asc' || u === 'price_desc' || u === 'popular' || u === 'departure_asc')
    return u
  return 'popular'
}

/** 목록 풀 단계에서 출발 행이 필요한 필터만 — 기본 browse는 Product derived 만 사용 */
function browsePoolNeedsDepartureAttach(opts: {
  paxFilter: number | null
  domesticLike: boolean
  dmPillar: string
  dmItem: string
  departHours: string[]
  departWeekdays: number[]
}): boolean {
  if (opts.paxFilter != null && !Number.isNaN(opts.paxFilter) && opts.paxFilter > 0) return true
  if (opts.departHours.length > 0 || opts.departWeekdays.length > 0) return true
  if (
    opts.domesticLike &&
    opts.dmPillar === 'schedule' &&
    (opts.dmItem === 'weekend' || opts.dmItem === 'weekday')
  ) {
    return true
  }
  return false
}

/**
 * GET /api/products/browse
 *
 * 예산 필터는 등록된 상품의 실제 금액을 확인하여 예산 범위 내 상품만 노출한다.
 * (priceFrom / 출발별 adultPrice / 레거시 adult 중 최소 = 인당 유효가)
 */
function productHasStoredHeroSeo(
  p: Pick<ProductBrowseIncludedRow, 'publicImageHeroSeoLine' | 'publicImageHeroSeoKeywordsJson'>,
): boolean {
  if (String(p.publicImageHeroSeoLine ?? '').trim()) return true
  const raw = p.publicImageHeroSeoKeywordsJson
  return typeof raw === 'string' && raw.trim().length > 2
}

/** PERF-LOG: 측정 후 제거 — GET Server-Timing용 (응답 본문 변경 없음) */
export let browsePerfLastPhases: {
  parseMs: number
  dbMs: number
  filterMs: number
  scoreMs: number
  mapMs: number
  rowCount: number
  finalCount: number
  cacheKey: string
} | null = null

type HubCatalogSlimBrowseItem = Record<string, unknown> & {
  browseFilterMeta?: unknown
  coverImageDisplayName?: unknown
  earliestDeparture?: unknown
  priceFrom?: unknown
  bgImageUrl?: string | null
  coverImageUrl?: string | null
}

/** `hubCatalog` 명시 쿼리(해외 허브 카탈로그) — 응답 JSON만 축소. map 로직·DB는 동일. */
function slimHubCatalogBrowseItem(item: HubCatalogSlimBrowseItem): Record<string, unknown> {
  const {
    browseFilterMeta: _browseFilterMeta,
    coverImageDisplayName: _coverImageDisplayName,
    earliestDeparture: _earliestDeparture,
    priceFrom: _priceFrom,
    bgImageUrl,
    coverImageUrl,
    ...rest
  } = item
  const slimmed: Record<string, unknown> = { ...rest, coverImageUrl }
  const bg = (bgImageUrl ?? '').trim()
  const cover = (coverImageUrl ?? '').trim()
  if (bg && bg !== cover) slimmed.bgImageUrl = bgImageUrl
  return slimmed
}

/** 성공 JSON 본문만 반환 — 실패는 throw (unstable_cache가 500 Response를 캐시하지 않도록). */
export async function productsBrowseBuildPayload(queryKey: string) {
  const perf = process.env.BONGTOUR_PERF_LOG === '1' ? { t0: performance.now(), parse: 0, db: 0, filter: 0, score: 0, map: 0, rowCount: 0, finalCount: 0 } : null // PERF-LOG: 측정 후 제거
  const searchParams = new URLSearchParams(queryKey)
  const isHubFullCatalog = isOverseasHubFullCatalogQueryKey(queryKey)
  // slim 적용 조건:
  // - hubCatalog 명시 파라미터 존재 (현재는 hubCatalog=6만)
  // - isHubFullCatalog만으로 적용하지 않음 — 향후 ProductsBrowseClient가
  //   geo 없는 full catalog 쿼리로 sidebar(facets/browseFilterMeta) 쓸 가능성 보호
  const hubCatalogParam = searchParams.get('hubCatalog')
  const applyHubCatalogSlim =
    isHubFullCatalog && hubCatalogParam !== null && hubCatalogParam.trim() !== ''
    const q = parseBrowseQuery(searchParams)

    const typeParam = searchParams.get('type')
    const sort = parseSort(searchParams.get('sort'))
    const region = searchParams.get('region')
    const country = searchParams.get('country')
    const menuGroup = searchParams.get('menuGroup')?.trim() || null
    const destination = searchParams.get('destination')?.trim() || null
    const city = searchParams.get('city')?.trim() || destination
    const scope = searchParams.get('scope')
    const sportsThemeParam = searchParams.get('sportsTheme')?.trim() || null
    const hasOverseasUrlGeo =
      scope !== 'domestic' &&
      Boolean(
        (region ?? '').trim() ||
          (country ?? '').trim() ||
          (city ?? '').trim() ||
          sportsThemeParam,
      )
    const overseasGeoAnd: Prisma.ProductWhereInput[] = []
    let browseRegionCountryKeys: string[] = []
    let overseasRegionTabOnlyGeo = false
    if (hasOverseasUrlGeo) {
      const r = (region ?? '').trim()
      const c = (country ?? '').trim()
      const ct = (city ?? '').trim()
      const localDepTag = localDepartureTagForBrowseRegion(r)
      const sportsThemeTag = sportsThemeTagForBrowseRegion(r, sportsThemeParam)
      overseasRegionTabOnlyGeo =
        Boolean(r) &&
        !c &&
        !ct &&
        !menuGroup &&
        !localDepTag &&
        r !== 'sports_theme' &&
        !sportsThemeParam
      if (localDepTag) {
        overseasGeoAnd.push({ localDepartureTag: { has: localDepTag } })
      } else if (r === 'sports_theme' || sportsThemeParam) {
        if (sportsThemeTag) {
          overseasGeoAnd.push({ sportsThemeTag: { has: sportsThemeTag } })
        } else {
          /** 테마 미지정 시 `sportsThemeTag` 빈 배열 상품 제외 — 미태그 상품 유입 방지 */
          overseasGeoAnd.push({ sportsThemeTag: { isEmpty: false } })
        }
      } else if (overseasRegionTabOnlyGeo) {
        browseRegionCountryKeys = await resolveBrowseRegionToCountryKeys(r)
      } else {
        const geo = await buildOverseasBrowseGeoResolution({
          region,
          country,
          city: ct,
          menuGroup,
        })
        browseRegionCountryKeys = geo.regionCountryKeys
        overseasGeoAnd.push(...geo.whereClauses)
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
      const seasonKeys =
        seasonKeySlugs.length > 0
          ? seasonKeySlugs
          : seasonDbCountries.flatMap((lab) => resolveBrowseCountryParamToCountryKeySlugs(lab))
      overseasGeoAnd.push(prismaWhereProductCountryTagKeysIn(seasonKeys))
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
    const baseTerms = destinationTermsFromQuery(region, country, city, menuGroup)
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
    /** 해외·국내·항공+호텔 허브: 등록 풀 전량. `/products` 등 일반 목록만 60 상한 */
    const isTravelHubScope = scopeForLimit === 'overseas' || scopeForLimit === 'domestic'
    const limitCap = isTravelHubScope ? 10_000 : 60
    const limit = Math.min(limitCap, Math.max(1, rawLimit ?? (isTravelHubScope ? limitCap : 24)))

    if (perf) perf.parse = performance.now() // PERF-LOG: 측정 후 제거

    const listingKindRaw = searchParams.get('listingKind')
    const listingKindParsed = listingKindRaw ? parseListingKind(listingKindRaw) : null
    const listingSliceWhere = prismaWhereClausesForBrowseListingSlice({
      scope: scopeForLimit,
      typeParam,
      listingKindParsed,
      airHotelCategory: q.categories.some((c) => isAirHotelBrowseCategoryToken(c)),
    })

    const travelScopeDb =
      prismaWhereForBrowseTravelScope(scopeForLimit) ??
      prismaWhereForBrowseTravelScope(region?.trim() ? 'overseas' : null)

    const productRows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        AND: [
          ...(overseasGeoAnd.length > 0 ? overseasGeoAnd : []),
          ...(travelScopeDb ? [travelScopeDb] : []),
          ...listingSliceWhere,
          publicProductWhereClause(),
        ],
      },
      orderBy: [
        { hasUrgentDeal: 'desc' },
        { urgentDealNextDate: { sort: 'asc', nulls: 'last' } },
        { updatedAt: 'desc' },
      ],
      select: buildProductBrowseFindManySelectWithoutDepartures(),
    })

    const overseasLike = scope === 'overseas' || !!region
    const domesticLike = scope === 'domestic'

    const poolNeedsDepartures = browsePoolNeedsDepartureAttach({
      paxFilter,
      domesticLike,
      dmPillar,
      dmItem,
      departHours: q.departHours,
      departWeekdays: q.departWeekdays,
    })
    let rows: ProductBrowseIncludedRow[]
    if (poolNeedsDepartures) {
      const departureByProductId = await fetchBrowseDeparturesByProductIds(
        productRows.map((p) => p.id),
      )
      rows = attachBrowseDeparturesToProducts(productRows, departureByProductId)
    } else {
      rows = productBrowseRowsWithEmptyDepartures(productRows)
    }
    if (perf) {
      perf.db = performance.now() // PERF-LOG: 측정 후 제거
      perf.rowCount = rows.length // PERF-LOG: 측정 후 제거
    }
    const skipGlobalTripDaysForDomesticSchedule =
      domesticLike && dmPillar === 'schedule' && dmItem.length > 0
    /** region만 있어도 해외 목적지 트리와 동일하게 travelScope 정렬 */
    const travelScopeParam = domesticLike ? 'domestic' : overseasLike ? 'overseas' : null
    const scopedBeforeTree = filterPoolByStoredTravelScope(rows, travelScopeParam)
    let pool: typeof rows = scopedBeforeTree
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
    if (listingKindParsed) {
      filteredRows = filteredRows.filter((p) => {
        const lk = p.listingKind
        if (listingKindParsed === 'travel') {
          return lk === 'travel' || lk == null || lk === ''
        }
        return lk === listingKindParsed
      })
    }

    /** 국내 허브만 자유여행 제외. 해외 허브는 패키지·자유여행 통합 노출 */
    const wantsAirHotelHubSlice =
      parseBrowseType(typeParam) === AIR_HOTEL_BROWSE_TYPE ||
      q.categories.some((c) => isAirHotelBrowseCategoryToken(c)) ||
      listingKindParsed === 'air_hotel_free'
    if (domesticLike && !wantsAirHotelHubSlice) {
      filteredRows = filteredRows.filter((p) => !isAirHotelProduct(p))
    }

    if (overseasRegionTabOnlyGeo) {
      const regionTabId = (region ?? '').trim()
      filteredRows = filteredRows.filter((p) =>
        productMatchesBrowseRegionTab(
          {
            title: p.title,
            originSource: p.originSource,
            primaryDestination: p.primaryDestination,
            destinationRaw: p.destinationRaw,
            destination: p.destination,
            primaryRegion: p.primaryRegion,
            country: p.country ?? null,
            city: p.city ?? null,
            countryKey: p.countryKey ?? null,
            continentKey: p.continentKey ?? null,
            cityKey: p.cityKey ?? null,
            nodeKey: p.nodeKey ?? null,
            countryTags: p.countryTags,
            cityTags: p.cityTags,
          },
          regionTabId,
        ),
      )
    }

    if (wantsAirHotelHubSlice) {
      filteredRows = filteredRows.filter((p) => isAirHotelProduct(p))
    }

    let scoringDestinationTerms = destinationTerms
    if (hasOverseasUrlGeo) {
      scoringDestinationTerms =
        menuGroup || extraTerms.length > 0 ? [...baseTerms, ...extraTerms] : []
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

    /** 해외 URL geo: 1차 Prisma `ProductCountryTag`/`ProductCityTag` where만 적용. 메모리 재필터는 하지 않는다. */
    const urlGeoForScore = hasOverseasUrlGeo
      ? undefined
      : { region, country, city, regionCountryKeys: browseRegionCountryKeys }

    const scoredForFacets = scoreAndFilterProducts(filteredRows, {
      type: browseTypeForScore,
      destinationTerms: scoringDestinationTerms,
      budgetPerPersonMax: null,
      sort: 'popular',
      urlGeo: urlGeoForScore,
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
      urlGeo: urlGeoForScore,
    })

    if (departMonth && /^\d{4}-\d{2}$/.test(departMonth)) {
      const monthKeyFromDate = (dt: Date) => toSeoulYmd(dt).slice(0, 7)
      const scoredIds = scored.map((s) => s.product.id)
      const anyDepartureInMonth = await fetchProductIdsWithDepartureInCalendarMonth(
        scoredIds,
        departMonth,
      )
      /** bookable `nextBookableDepartureAt` 우선, 없으면 해당 월 출발 행 존재 여부(과거 출발 포함) */
      scored = scored.filter((s) => {
        const bookable = s.earliestDeparture
        if (bookable && monthKeyFromDate(bookable) === departMonth) return true
        return anyDepartureInMonth.has(s.product.id)
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

    const sliceProductIds = slice.map(({ product }) => product.id)
    const sliceProductIdsNeedingSchedule = slice
      .filter(({ product }) => !String(product.bgImageUrl ?? '').trim())
      .map(({ product }) => product.id)

    const [sliceDepartureByProductId, scheduleByProductId] = isHubFullCatalog
      ? [
          new Map<string, ProductBrowseIncludedRow['departures']>(),
          sliceProductIdsNeedingSchedule.length > 0
            ? await fetchProductBrowseScheduleByIds(sliceProductIdsNeedingSchedule)
            : new Map<string, string | null>(),
        ]
      : await Promise.all([
          fetchBrowseDeparturesByProductIds(sliceProductIds),
          fetchProductBrowseScheduleByIds(sliceProductIdsNeedingSchedule),
        ])

    const metaRows = slice.map(({ product: p, effectivePricePerPerson }) => {
      const hasBgImage = Boolean(String(p.bgImageUrl ?? '').trim())
      const scheduleRows = hasBgImage
        ? []
        : getScheduleFromProduct({
            ...p,
            schedule: scheduleByProductId.get(p.id) ?? null,
          })
      const coverUrl = getFinalCoverImageUrl({
        bgImageUrl: p.bgImageUrl,
        scheduleDays: scheduleRows,
      })
      const firstScheduleName = hasBgImage
        ? null
        : (scheduleRows.find((d) => d.imageDisplayName?.trim())?.imageDisplayName?.trim() ?? null)
      return { p, effectivePricePerPerson, scheduleRows, coverUrl, firstScheduleName }
    })

    const urlsForCaptionBatch = isHubFullCatalog
      ? []
      : metaRows
          .filter(
            (m) => !m.firstScheduleName && m.coverUrl && !productHasStoredHeroSeo(m.p),
          )
          .map((m) => m.coverUrl as string)
    const captionMap = isHubFullCatalog
      ? new Map<string, string>()
      : await buildCaptionLookupMapFromPublicUrls(urlsForCaptionBatch)

    const overseasGeoFieldCache = new Map<
      string,
      {
        overseasBucket: ReturnType<typeof resolveOverseasDisplayBucketForBrowse>
        countryRowLabel: string
        browseMegaRegionTabId: string | null
      }
    >()

    const mappedItems = metaRows.map(({ p: pRaw, effectivePricePerPerson, coverUrl, firstScheduleName }) => {
      const departures = sliceDepartureByProductId.get(pRaw.id) ?? []
      const p: ProductBrowseIncludedRow = {
        ...(pRaw as ProductBrowseIncludedRow),
        departures,
      }
      const seatAwareMin = isHubFullCatalog ? null : minBrowseBookableAdultPrice(departures)
      const cardPriceKrw =
        seatAwareMin ??
        (isHubFullCatalog && p.minBookableAdultPrice != null ? p.minBookableAdultPrice : null) ??
        computeEffectivePricePerPersonKrwFromRow(
          { ...p, departures },
          { seatAware: !isHubFullCatalog },
        ) ??
        effectivePricePerPerson
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
      slug: p.slug ?? null,
      title: p.title,
      originSource: p.originSource,
      productType: p.productType,
      listingKind: p.listingKind ?? null,
      airportTransferType: airportTransferTypeForListingKind(p.listingKind, {
        airportTransferType: p.airportTransferType,
        includedText: p.includedText,
        excludedText: p.excludedText,
      }),
      primaryDestination: (() => {
        const label = resolveProductListDestinationLabel({
          primaryDestination: p.primaryDestination,
          destination: p.destination,
          destinationRaw: p.destinationRaw,
          primaryRegion: p.primaryRegion,
          title: p.title,
        })
        return label !== '—' ? label : p.primaryDestination
      })(),
      primaryRegion: p.primaryRegion,
      duration: p.duration,
      bgImageUrl: p.bgImageUrl,
      coverImageUrl: coverUrl,
      priceFrom: p.priceFrom,
      effectivePricePerPersonKrw: cardPriceKrw,
      earliestDeparture:
        p.nextBookableDepartureAt?.toISOString() ??
        p.departures[0]?.departureDate?.toISOString() ??
        null,
      browseFilterMeta: buildBrowseItemFilterMeta(p),
      ...(isHubFullCatalog
        ? {
            countryTags: (p.countryTags ?? []).map((t) => ({
              countryKey: t.countryKey,
              nodeKey: t.nodeKey ?? null,
            })),
            cityTags: (p.cityTags ?? []).map((t) => ({ cityKey: t.cityKey })),
          }
        : {}),
      sportsThemeTags: normalizeSportsThemeTagsForBrowse(p.sportsThemeTag),
      ...(p.hasUrgentDeal
        ? (() => {
            const ymd = p.urgentDealNextDate
              ? departureDateToYmd(p.urgentDealNextDate)
              : null
            const dep =
              ymd != null
                ? (p.departures ?? []).find((d) => departureDateToYmd(d.departureDate) === ymd)
                : null
            if (!ymd) return { hasUrgentDeal: true as const }
            return {
              hasUrgentDeal: true as const,
              urgentDealNextDepartureDate: ymd,
              ...(dep?.baselineAdultPrice != null && dep.adultPrice != null
                ? {
                    urgentDealBaselinePriceKrw: dep.baselineAdultPrice,
                    urgentDealCurrentPriceKrw: dep.adultPrice,
                  }
                : {}),
            }
          })()
        : {}),
      ...(scope === 'overseas' || region
        ? (() => {
            const matchInput = {
              title: p.title,
              originSource: p.originSource,
              primaryDestination: p.primaryDestination,
              destinationRaw: p.destinationRaw,
              destination: p.destination,
              primaryRegion: p.primaryRegion,
              country: p.country ?? null,
              city: p.city ?? null,
              countryKey: p.countryKey ?? null,
              continentKey: p.continentKey ?? null,
              cityKey: p.cityKey ?? null,
              nodeKey: p.nodeKey ?? null,
              countryTags: p.countryTags,
              cityTags: p.cityTags,
            }
            const sportsThemeTags = normalizeSportsThemeTagsForBrowse(p.sportsThemeTag)
            const geoCacheKey = [
              p.cityKey ?? '',
              p.countryKey ?? '',
              p.nodeKey ?? '',
              p.primaryDestination ?? '',
              sportsThemeTags.join(','),
              (p.countryTags ?? []).map((t) => t.countryKey).sort().join(','),
              !p.cityKey?.trim() && !p.countryKey?.trim() ? p.title : '',
            ].join('\0')
            const canReuseGeoCache = Boolean(p.cityKey?.trim() || p.countryKey?.trim())
            const cachedGeo = canReuseGeoCache ? overseasGeoFieldCache.get(geoCacheKey) : undefined
            if (cachedGeo) {
              const hubSubgroupRegionId =
                isHubFullCatalog &&
                cachedGeo.browseMegaRegionTabId &&
                isMegaMenuRegionCityGroupTabId(cachedGeo.browseMegaRegionTabId)
                  ? cachedGeo.browseMegaRegionTabId
                  : null
              return {
                overseasBucket: cachedGeo.overseasBucket,
                countryRowLabel: cachedGeo.countryRowLabel,
                browseMegaSubgroupLabel: hubSubgroupRegionId
                  ? resolveOverseasMegaMenuSubgroupLabelFromCountryRow(
                      hubSubgroupRegionId,
                      cachedGeo.countryRowLabel,
                    )
                  : null,
                browseCountry: (p.country ?? '').trim() || null,
                browseMegaRegionTabId: cachedGeo.browseMegaRegionTabId,
              }
            }
            const match = matchProductToOverseasNode(matchInput)
            const overseasBucket = resolveOverseasDisplayBucketForBrowse(matchInput, match)
            const countryRowLabel = resolveOverseasCountryRowLabelForBrowse(matchInput, match)
            const browseMegaRegionTabId = resolveBrowseMegaRegionTabIdForBrowse(
              matchInput,
              match,
              overseasBucket,
              sportsThemeTags,
            )
            overseasGeoFieldCache.set(geoCacheKey, {
              overseasBucket,
              countryRowLabel,
              browseMegaRegionTabId,
            })
            const regionForSubgroup =
              (region ?? '').trim() ||
              (browseMegaRegionTabId && isMegaMenuRegionCityGroupTabId(browseMegaRegionTabId)
                ? browseMegaRegionTabId
                : '')
            const browseMegaSubgroupLabel = regionForSubgroup
              ? resolveOverseasMegaMenuSubgroupLabelForBrowse(
                  matchInput,
                  match,
                  regionForSubgroup,
                  countryRowLabel,
                )
              : null
            const browseCountry = (p.country ?? '').trim() || null
            return {
              overseasBucket,
              countryRowLabel,
              browseMegaSubgroupLabel,
              browseCountry,
              browseMegaRegionTabId,
            }
          })()
        : {}),
    }
    })

    const items = applyHubCatalogSlim
      ? mappedItems.map((item) => slimHubCatalogBrowseItem(item as HubCatalogSlimBrowseItem))
      : mappedItems

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
        cacheKey: `products-browse-v19|${queryKey}`,
      }
      browsePerfLastPhases = phases // PERF-LOG: 측정 후 제거
      console.log('[browse-perf]', JSON.stringify({ cacheHit: false, ...phases })) // PERF-LOG: 측정 후 제거
    }

    if (applyHubCatalogSlim) {
      return {
        ok: true as const,
        total,
        page,
        limit,
        items,
        suggestedBudgetMax,
      }
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

