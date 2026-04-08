import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PRODUCT_BROWSE_FULL_INCLUDE } from '@/lib/product-browse-full-include'
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
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'
import { isOnOrAfterPublicBookableMinDate } from '@/lib/public-bookable-date'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { mapMatchToOverseasDisplayBucket } from '@/lib/overseas-display-buckets'
import { filterPoolByStoredTravelScope } from '@/lib/travel-scope-pool-filter'
import { parseListingKind } from '@/lib/product-listing-kind'

export const dynamic = 'force-dynamic'

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

/**
 * GET /api/products/browse
 *
 * 예산 필터는 등록된 상품의 실제 금액을 확인하여 예산 범위 내 상품만 노출한다.
 * (priceFrom / 출발별 adultPrice / 레거시 adult 중 최소 = 인당 유효가)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = parseBrowseQuery(searchParams)

    const typeParam = searchParams.get('type')
    const sort = parseSort(searchParams.get('sort'))
    const region = searchParams.get('region')
    const country = searchParams.get('country')
    const city = searchParams.get('city')

    const budgetRaw = searchParams.get('budgetPerPerson')
    const budgetPerPersonMax =
      budgetRaw != null && budgetRaw !== '' ? Math.max(0, parseInt(budgetRaw, 10)) : null
    if (budgetPerPersonMax != null && Number.isNaN(budgetPerPersonMax)) {
      return NextResponse.json({ ok: false, error: 'budgetPerPerson 형식이 올바르지 않습니다.' }, { status: 400 })
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

    const tripDaysRaw = searchParams.get('tripDays')
    const tripDaysFilter =
      tripDaysRaw != null && tripDaysRaw !== '' ? parseInt(tripDaysRaw, 10) : null
    const departMonth = searchParams.get('departMonth')
    const paxRaw = searchParams.get('pax')
    const paxFilter = paxRaw != null && paxRaw !== '' ? parseInt(paxRaw, 10) : null

    const page = q.page
    const limit = q.limit

    const rows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
      },
      orderBy: { updatedAt: 'desc' },
      include: PRODUCT_BROWSE_FULL_INCLUDE,
    })
    const rowsWithPublicDepartures = rows
      .map((p) => {
        const nextDepartures = (p.departures ?? []).filter((d) =>
          isOnOrAfterPublicBookableMinDate(d.departureDate)
        )
        const hadAnyDepartureRows = (p.departures?.length ?? 0) > 0
        if (hadAnyDepartureRows && nextDepartures.length === 0) {
          return null
        }
        return {
          ...p,
          departures: nextDepartures,
        }
      })
      .filter((p): p is (typeof rows)[number] => p != null)

    const scope = searchParams.get('scope')
    const overseasLike = scope === 'overseas' || !!region
    const domesticLike = scope === 'domestic'
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
    if (tripDaysFilter != null && !Number.isNaN(tripDaysFilter)) {
      filteredRows = filteredRows.filter((p) => p.tripDays === tripDaysFilter)
    }
    if (paxFilter != null && !Number.isNaN(paxFilter) && paxFilter > 0) {
      filteredRows = filteredRows.filter((p) => {
        if (!Array.isArray(p.departures) || p.departures.length === 0) return true
        return p.departures.some((d) => d.minPax == null || paxFilter >= d.minPax)
      })
    }

    /** DB `Product.listingKind` 로 한정 (예: 단독여행 히어로 = private_trip 만) */
    const listingKindRaw = searchParams.get('listingKind')
    const listingKindParsed = listingKindRaw ? parseListingKind(listingKindRaw) : null
    if (listingKindParsed) {
      filteredRows = filteredRows.filter((p) => p.listingKind === listingKindParsed)
    }

    /** 사이드바 상품유형이 있으면 1차 유형은 카테고리 필터에 맡기고 목적지만 좁힌다 */
    const browseTypeForScore: ProductBrowseType | null =
      q.categories.length > 0 ? null : parseBrowseType(typeParam)

    const effectiveSort: BrowseSort =
      budgetPerPersonMax != null && sort === 'popular'
        ? 'budget_fit'
        : sort === 'budget_fit' && budgetPerPersonMax == null
          ? 'popular'
          : sort

    const scoredForFacets = scoreAndFilterProducts(filteredRows, {
      type: browseTypeForScore,
      destinationTerms,
      budgetPerPersonMax: null,
      sort: 'popular',
    })

    const facetRows = scoredForFacets.map((s) => s.product as ProductBrowseFullRow)
    const brandFacets = aggregateBrandFacets(facetRows)
    const airlineFacets = aggregateAirlineFacets(facetRows)
    const facetFlags = computeFacetFlags(facetRows)

    let scored = scoreAndFilterProducts(filteredRows, {
      type: browseTypeForScore,
      destinationTerms,
      budgetPerPersonMax,
      sort: effectiveSort,
    })

    if (departMonth && /^\d{4}-\d{2}$/.test(departMonth)) {
      const [y, m] = departMonth.split('-').map((x) => parseInt(x, 10))
      scored = scored.filter((s) => {
        const d = s.earliestDeparture
        if (!d) return false
        return d.getFullYear() === y && d.getMonth() + 1 === m
      })
    }

    const ext: ExtendedBrowseFilters = {
      departureConfirmed: q.confirmed || undefined,
      noOptionalTour: q.noOptionalTour || undefined,
      noShopping: q.noShopping || undefined,
      freeScheduleIncluded: q.freeSchedule || undefined,
      brandKeys: q.brands.length > 0 ? q.brands : undefined,
      productCategories: q.categories.length > 0 ? q.categories : undefined,
      travelGrades: q.travelGrades.length > 0 ? q.travelGrades : undefined,
      companions: q.companions.length > 0 ? q.companions : undefined,
      airlineCodes: q.airlines.length > 0 ? q.airlines : undefined,
      departureHourBuckets: q.departHours.length > 0 ? q.departHours : undefined,
      departureWeekdays: q.departWeekdays.length > 0 ? q.departWeekdays : undefined,
      budgetMin: q.budgetMin,
      budgetMax: null,
    }

    scored = scored.filter((s) => productRowPassesExtendedFilters(s.product as ProductBrowseFullRow, ext))

    const total = scored.length
    const slice = scored.slice((page - 1) * limit, page * limit)

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

    const items = metaRows.map(({ p, effectivePricePerPerson, coverUrl, firstScheduleName }) => ({
      coverImageDisplayName:
        firstScheduleName ??
        lookupCaptionFromMap(captionMap, coverUrl) ??
        displayNameFromImageUrl(coverUrl),
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
            const match = matchProductToOverseasNode({
              title: p.title,
              originSource: p.originSource,
              primaryDestination: p.primaryDestination,
              destinationRaw: p.destinationRaw,
              destination: p.destination,
              primaryRegion: p.primaryRegion,
            })
            const overseasBucket = mapMatchToOverseasDisplayBucket(match)
            const countryRowLabel =
              match?.countryLabel?.trim() || p.primaryDestination?.trim() || '기타'
            return { overseasBucket, countryRowLabel }
          })()
        : {}),
    }))

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

    const payload = {
      ok: true,
      total,
      page,
      limit,
      items,
      destinationTerms,
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
        travelGrades: q.travelGrades,
        companions: q.companions,
        region,
        country,
        city,
      },
    }
    assertNoInternalMetaLeak(payload, '/api/products/browse')
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[GET /api/products/browse]', e)
    let q: ReturnType<typeof parseBrowseQuery>
    try {
      const { searchParams } = new URL(request.url)
      q = parseBrowseQuery(searchParams)
    } catch {
      return NextResponse.json({ ok: false, error: '요청 파라미터를 처리하지 못했습니다.' }, { status: 400 })
    }
    const sp = new URL(request.url).searchParams
    const fallback = {
      ok: true,
      total: 0,
      page: q.page,
      limit: q.limit,
      items: [],
      destinationTerms: [],
      suggestedBudgetMax: null,
      facets: {
        brands: [],
        airlines: [],
        hasDepartureTimeData: false,
        hasWeekdayData: false,
      },
      queryEcho: {
        type: sp.get('type'),
        categories: q.categories,
        travelGrades: q.travelGrades,
        companions: q.companions,
        region: sp.get('region'),
        country: sp.get('country'),
        city: sp.get('city'),
      },
    }
    assertNoInternalMetaLeak(fallback, '/api/products/browse')
    return NextResponse.json(fallback)
  }
}
