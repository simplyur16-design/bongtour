/**
 * B-4 마케팅: Product → 도시·시기·키워드 추출 + 월별 후보 매칭 (읽기 전용).
 * 상담 CTA는 `/inquiry?type=travel&productId=…` 패턴 + UTM (`lib/inquiry-page` 와 정합).
 */
import { DOMESTIC_LOCATION_TREE_CLEAN } from '@/lib/domestic-location-tree'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { isValidYearMonth } from '@/lib/monthly-curation'
import { findLeafInTree } from '@/lib/overseas-location-tree'
import { parseTravelScope, type ProductTravelScope } from '@/lib/product-listing-kind'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketingUtmSource = 'naver_blog' | 'facebook' | 'instagram'

export type MarketingUtmContentPosition = 'final_cta' | 'inline_cta'

export type ProductGeoMeta = {
  productId: string
  /** 한글 국가/권역 라벨 (browse 슬러그 역매핑 우선) */
  country: string
  /** 한글 도시·목적지 (해외 트리·국내 트리·primaryDestination 보조) */
  city: string | null
  /** 대륙 광역 — 트리 groupKey 기반, 없으면 null */
  region: 'asia' | 'europe' | 'americas' | null
  travelScope: ProductTravelScope
  durationDays: number | null
  departureMonths: string[]
  keywords: string[]
  inquiryUrl: string
  /** CTA 링크 텍스트용 짧은 상품명 (상담 폼 snapshot) */
  ctaProductTitle: string
}

export type ExtractProductGeoMetaCtaOptions = {
  utmSource: MarketingUtmSource
  utmContent?: MarketingUtmContentPosition
  /** utm_campaign 접두 (YYYY-MM). 미지정 시 출발 월 첫 값 또는 서울 당월 */
  campaignMonthKey?: string
}

export type MarketingCandidate = {
  productId: string
  score: number
  country: string
  city: string | null
  reason: string
}

export type ListProductsForMarketingMonthOptions = {
  /** `MonthlyCurationContent` 동일 monthKey 에 이미 연결된 상품 제외 (기본 true) */
  excludeMonthlyCurationLinked?: boolean
  /** 후보 상한 (기본 30) */
  limit?: number
}

// ---------------------------------------------------------------------------
// Inquiry + UTA (B-4-2 재사용용 순수 빌더)
// ---------------------------------------------------------------------------

export type BuildProductMarketingInquiryHrefArgs = {
  productId: string
  snapshotProductTitle: string
  /** 상담 폼 사전 채움용 희망 월 (YYYY-MM) */
  targetYearMonth: string | null
  utmSource: MarketingUtmSource
  utmContent?: MarketingUtmContentPosition
  campaignMonthKey: string
  citySlugForCampaign: string
}

/**
 * 봉투어 여행 상담 딥링크 + 마케팅 UTM.
 * SSOT: `lib/inquiry-page` 의 travel 분기와 동일 키(`productId`, `snapshotProductTitle`, `targetYearMonth`).
 */
export function buildProductMarketingInquiryHref(args: BuildProductMarketingInquiryHrefArgs): string {
  const p = new URLSearchParams()
  p.set('type', 'travel')
  p.set('productId', args.productId)
  if (args.snapshotProductTitle.trim()) p.set('snapshotProductTitle', args.snapshotProductTitle.trim())
  if (args.targetYearMonth && isValidYearMonth(args.targetYearMonth)) {
    p.set('targetYearMonth', args.targetYearMonth)
  }
  p.set('utm_source', args.utmSource)
  p.set('utm_medium', 'cta')
  p.set('utm_campaign', `${args.campaignMonthKey}-${args.citySlugForCampaign}`)
  p.set('utm_content', args.utmContent ?? 'final_cta')
  return `/inquiry?${p.toString()}`
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CTA_TITLE_MAX = 52

function seoulYearMonthNow(): string {
  const d = new Date()
  const seoul = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = seoul.getFullYear()
  const m = String(seoul.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function utcMonthStart(monthKey: string): Date {
  const [ys, ms] = monthKey.split('-')
  const y = Number(ys)
  const mo = Number(ms)
  return new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0))
}

function addMonthsUtc(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, d.getUTCDate()))
}

function formatYm(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthKeysInWindow(startMonthKey: string, spanMonths: number): string[] {
  const start = utcMonthStart(startMonthKey)
  const keys: string[] = []
  for (let i = 0; i < spanMonths; i++) {
    keys.push(formatYm(addMonthsUtc(start, i)))
  }
  return keys
}

function departureYmSet(dates: Date[]): string[] {
  const set = new Set<string>()
  for (const dt of dates) {
    set.add(formatYm(dt))
  }
  return [...set].sort()
}

function parseDurationDays(duration: string | null | undefined, tripDays: number | null | undefined): number | null {
  if (tripDays != null && tripDays > 0) return tripDays
  const raw = (duration ?? '').trim()
  if (!raw) return null
  const m = raw.replace(/\s+/g, '').match(/(\d+)박(\d+)일/)
  if (m) return Number(m[2]) || null
  const m2 = raw.match(/(\d+)\s*일/)
  if (m2) return Number(m2[1]) || null
  return null
}

function parseNightsLabel(duration: string | null | undefined, tripNights: number | null | undefined): string | null {
  if (tripNights != null && tripNights > 0) return `${tripNights}박`
  const raw = (duration ?? '').trim()
  if (!raw) return null
  const m = raw.replace(/\s+/g, '').match(/(\d+)박/)
  if (m) return `${m[1]}박`
  return null
}

function marketingRegionFromGroupKey(groupKey: string | null | undefined): ProductGeoMeta['region'] {
  const g = (groupKey ?? '').trim()
  if (!g) return null
  if (g === 'sea-taiwan-south-asia' || g === 'japan' || g === 'china-circle') return 'asia'
  if (g === 'europe-me-africa') return 'europe'
  if (g === 'americas') return 'americas'
  if (g === 'guam-au-nz') return null
  return null
}

function marketingRegionFallback(countrySlug: string | null | undefined): ProductGeoMeta['region'] {
  const s = (countrySlug ?? '').toLowerCase()
  if (!s) return null
  const asia = new Set([
    'japan',
    'thailand',
    'vietnam',
    'philippines',
    'taiwan',
    'singapore',
    'indonesia',
    'laos',
    'malaysia',
    'cambodia',
    'china',
    'hong-kong-macau',
    'mongolia',
    'maldives',
    'india-nepal-sri-lanka',
  ])
  const europe = new Set([
    'uk',
    'france',
    'italy',
    'spain',
    'germany',
    'switzerland',
    'greece',
    'turkey',
    'czech',
    'austria',
    'portugal',
    'hungary',
    'netherlands',
    'belgium',
    'ireland',
    'norway',
    'finland',
    'denmark',
    'sweden',
    'iceland',
    'morocco',
    'egypt',
    'western-europe',
    'eastern-europe',
    'southern-europe',
    'northern-europe',
    'balkans',
  ])
  const americas = new Set(['usa', 'canada', 'hawaii', 'guam-saipan', 'latin-america', 'latin-mexico', 'latin-caribbean'])
  if (asia.has(s)) return 'asia'
  if (europe.has(s)) return 'europe'
  if (americas.has(s)) return 'americas'
  return null
}

function resolveTravelScope(raw: string | null | undefined, countrySlug: string | null | undefined): ProductTravelScope {
  const p = parseTravelScope(raw ?? undefined)
  if (p) return p
  const c = (countrySlug ?? '').toLowerCase()
  if (c === 'korea') return 'domestic'
  return 'overseas'
}

function resolveCountryKo(
  travelScope: ProductTravelScope,
  countrySlug: string | null | undefined,
  primaryDestination: string | null | undefined,
): string {
  if (travelScope === 'domestic') return '대한민국'
  const fromSlug = koreanCountryLabelFromBrowseSlug(countrySlug)
  if (fromSlug) return fromSlug
  const pd = (primaryDestination ?? '').trim()
  if (pd) return pd.split(/[,/]/)[0]!.trim()
  return '해외'
}

function resolveCityKo(input: {
  travelScope: ProductTravelScope
  groupKey: string | null
  countryKey: string | null
  nodeKey: string | null
  primaryDestination: string | null
  destinationRaw: string | null
}): string | null {
  if (input.travelScope === 'overseas' && input.groupKey && input.countryKey && input.nodeKey) {
    const hit = findLeafInTree(input.groupKey, input.countryKey, input.nodeKey)
    if (hit?.leaf) return hit.leaf.dbCityValue?.trim() || hit.leaf.nodeLabel.trim() || null
  }
  if (input.travelScope === 'domestic' && input.nodeKey) {
    const nk = input.nodeKey.trim()
    for (const g of DOMESTIC_LOCATION_TREE_CLEAN) {
      for (const a of g.areas) {
        const leaf = a.children.find((l) => l.nodeKey === nk)
        if (leaf) return leaf.nodeLabel.trim()
      }
    }
  }
  const pd = (input.primaryDestination ?? '').trim()
  if (pd) {
    const parts = pd.split(/[,/]/).map((x) => x.trim()).filter(Boolean)
    if (parts.length >= 2) return parts[1]!
    return parts[0]!
  }
  const dr = (input.destinationRaw ?? '').trim()
  if (dr) return dr.split(/[,/]/)[0]!.trim()
  return null
}

function slugifyCampaignCity(cityKo: string | null, citySlug: string | null, nodeKey: string | null): string {
  const ascii = (citySlug ?? '').trim().toLowerCase()
  if (ascii && /^[a-z0-9-]+$/.test(ascii)) return ascii.slice(0, 48)
  const nk = (nodeKey ?? '').trim().toLowerCase()
  if (nk && /^[a-z0-9-]+$/.test(nk)) return nk.slice(0, 48)
  const ko = (cityKo ?? '').trim()
  if (ko) {
    return ko
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'city'
  }
  return 'city'
}

function shortenCtaTitle(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim()
  if (t.length <= CTA_TITLE_MAX) return t
  return `${t.slice(0, CTA_TITLE_MAX - 1)}…`
}

function packageKeyword(productType: string | null | undefined): string {
  const p = (productType ?? '').trim()
  if (/자유/.test(p)) return '자유여행'
  return '패키지'
}

function buildKeywords(input: {
  city: string | null
  country: string
  departureMonths: string[]
  packageWord: string
  nightsLabel: string | null
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s: string) => {
    const x = s.trim()
    if (!x || seen.has(x)) return
    seen.add(x)
    out.push(x)
  }
  if (input.city) push(input.city)
  push(input.country)
  for (const ym of input.departureMonths.slice(0, 4)) {
    const mo = Number(ym.slice(5, 7))
    if (mo >= 1 && mo <= 12) push(`${mo}월`)
  }
  push(input.packageWord)
  if (input.nightsLabel) push(input.nightsLabel)
  return out
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 등록된 상품 1건의 마케팅 메타 + 상담 CTA URL (UTM 포함).
 * `cta` 가 없으면 URL에 utm을 넣을 수 없으므로 **필수**로 받는다.
 */
export async function extractProductGeoMeta(
  productId: string,
  cta: ExtractProductGeoMetaCtaOptions,
): Promise<ProductGeoMeta> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      country: true,
      city: true,
      groupKey: true,
      countryKey: true,
      nodeKey: true,
      primaryDestination: true,
      destinationRaw: true,
      travelScope: true,
      tripDays: true,
      tripNights: true,
      duration: true,
      productType: true,
      departures: { select: { departureDate: true }, orderBy: { departureDate: 'asc' } },
      prices: { select: { date: true }, orderBy: { date: 'asc' } },
    },
  })
  if (!row) throw new Error(`Product not found: ${productId}`)

  const travelScope = resolveTravelScope(row.travelScope, row.country)
  const country = resolveCountryKo(travelScope, row.country, row.primaryDestination)
  const city = resolveCityKo({
    travelScope,
    groupKey: row.groupKey,
    countryKey: row.countryKey,
    nodeKey: row.nodeKey,
    primaryDestination: row.primaryDestination,
    destinationRaw: row.destinationRaw,
  })

  const region = marketingRegionFromGroupKey(row.groupKey) ?? marketingRegionFallback(row.country)
  const durationDays = parseDurationDays(row.duration, row.tripDays)
  const depDates = [...row.departures.map((d) => d.departureDate), ...row.prices.map((p) => p.date)]
  const departureMonths = departureYmSet(depDates)

  const campaignMonthKey =
    (cta.campaignMonthKey && isValidYearMonth(cta.campaignMonthKey) ? cta.campaignMonthKey : null) ??
    departureMonths[0] ??
    seoulYearMonthNow()

  const citySlug = slugifyCampaignCity(city, row.city, row.nodeKey)
  const ctaProductTitle = shortenCtaTitle(row.title)
  const targetYm = departureMonths.find((x) => x === campaignMonthKey) ?? departureMonths[0] ?? null

  const inquiryUrl = buildProductMarketingInquiryHref({
    productId: row.id,
    snapshotProductTitle: ctaProductTitle,
    targetYearMonth: targetYm,
    utmSource: cta.utmSource,
    utmContent: cta.utmContent,
    campaignMonthKey,
    citySlugForCampaign: citySlug,
  })

  const keywords = buildKeywords({
    city,
    country,
    departureMonths,
    packageWord: packageKeyword(row.productType),
    nightsLabel: parseNightsLabel(row.duration, row.tripNights),
  })

  return {
    productId: row.id,
    country,
    city,
    region,
    travelScope,
    durationDays,
    departureMonths,
    keywords,
    inquiryUrl,
    ctaProductTitle,
  }
}

/**
 * `monthKey` 캠페인 월부터 연속 3개월 안에 출발(달력·레거시 가격)이 있는 등록 상품 후보 + 점수.
 */
export async function listProductsForMarketingMonth(
  monthKey: string,
  options?: ListProductsForMarketingMonthOptions,
): Promise<MarketingCandidate[]> {
  if (!isValidYearMonth(monthKey)) throw new Error(`Invalid monthKey: ${monthKey}`)

  const excludeLinked = options?.excludeMonthlyCurationLinked !== false
  const limit = Math.min(100, Math.max(1, options?.limit ?? 30))

  const windowKeys = monthKeysInWindow(monthKey, 3)
  const windowStart = utcMonthStart(windowKeys[0]!)
  const windowEndExclusive = addMonthsUtc(utcMonthStart(windowKeys[2]!), 1)

  let linkedIds = new Set<string>()
  if (excludeLinked) {
    const curations = await prisma.monthlyCurationContent.findMany({
      where: { monthKey, linkedProductId: { not: null } },
      select: { linkedProductId: true },
    })
    linkedIds = new Set(
      curations.map((c) => c.linkedProductId).filter((x): x is string => typeof x === 'string' && x.length > 0),
    )
  }

  const candidates = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [
        { departures: { some: { departureDate: { gte: windowStart, lt: windowEndExclusive } } } },
        { prices: { some: { date: { gte: windowStart, lt: windowEndExclusive } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      country: true,
      city: true,
      groupKey: true,
      countryKey: true,
      nodeKey: true,
      primaryDestination: true,
      destinationRaw: true,
      travelScope: true,
      tripDays: true,
      tripNights: true,
      duration: true,
      productType: true,
      priceFrom: true,
      departures: {
        where: { departureDate: { gte: windowStart, lt: windowEndExclusive } },
        select: { departureDate: true },
        orderBy: { departureDate: 'asc' },
      },
      prices: {
        where: { date: { gte: windowStart, lt: windowEndExclusive } },
        select: { date: true },
        orderBy: { date: 'asc' },
      },
    },
  })

  type Row = (typeof candidates)[number]

  function scoreOne(row: Row): { score: number; reason: string } {
    const depDates = [...row.departures.map((d) => d.departureDate), ...row.prices.map((p) => p.date)]
    const months = departureYmSet(depDates)
    const inExact = months.includes(monthKey)
    const travelScope = resolveTravelScope(row.travelScope, row.country)
    const country = resolveCountryKo(travelScope, row.country, row.primaryDestination)
    const city = resolveCityKo({
      travelScope,
      groupKey: row.groupKey,
      countryKey: row.countryKey,
      nodeKey: row.nodeKey,
      primaryDestination: row.primaryDestination,
      destinationRaw: row.destinationRaw,
    })
    let score = 5
    const bits: string[] = []
    if (inExact) {
      score += 40
      bits.push(`${monthKey} 출발 일정`)
    } else {
      bits.push(`${windowKeys.join('/')} 중 출발 가능`)
    }
    if (row.priceFrom != null && row.priceFrom > 0) {
      score += 8
      bits.push('가격 메타 있음')
    }
    if (city) {
      score += 6
      bits.push(`${city} 목적지`)
    } else {
      bits.push('목적지 메타 보강 권장')
    }
    if (row.tripDays != null && row.tripDays > 0) {
      score += 5
    }
    return { score, reason: bits.join(' · ') }
  }

  const pool = excludeLinked ? candidates.filter((row) => !linkedIds.has(row.id)) : candidates

  const scored = pool
    .map((row) => {
      const { score, reason } = scoreOne(row)
      const travelScope = resolveTravelScope(row.travelScope, row.country)
      const country = resolveCountryKo(travelScope, row.country, row.primaryDestination)
      const city = resolveCityKo({
        travelScope,
        groupKey: row.groupKey,
        countryKey: row.countryKey,
        nodeKey: row.nodeKey,
        primaryDestination: row.primaryDestination,
        destinationRaw: row.destinationRaw,
      })
      return { productId: row.id, score, country, city, reason }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const picked: MarketingCandidate[] = []
  const seenCity = new Set<string>()
  for (const row of scored) {
    if (picked.length >= limit) break
    const dedupeKey = `${row.country}|${row.city ?? '_'}`
    if (seenCity.has(dedupeKey) && picked.length > 0) continue
    seenCity.add(dedupeKey)
    picked.push(row)
  }

  return picked
}

// ---------------------------------------------------------------------------
// B-4-3: 자유여행(airtel/private) 블로그 초안용 상품 메타 (신규 export만 추가)
// ---------------------------------------------------------------------------

/** `extractAirtelBlogMeta` / `buildAirtelBlogProductMeta` 입력 — DB 일부 컬럼만 필요 */
export type AirtelBlogProductRow = {
  title: string
  summary: string | null
  benefitSummary: string | null
  airline: string | null
  airportTransferType: string | null
  airtelHotelInfoJson: string | null
}

export type AirtelBlogProductMeta = {
  airline: string | null
  airportTransferType: string | null
  /** 호텔 JSON·텍스트 요약(모델 입력용, 과장 금지) */
  airtelHotelSummary: string | null
  title: string
  summary: string | null
  benefitSummary: string | null
  /** 직항·경유·항공사 등 입력 기반 힌트 (없으면 null) */
  flightRouteHint: string | null
}

/**
 * Product 행에서 에어텔/프라이빗 블로그용 보조 메타를 만듭니다. (LLM 페이로드 전용)
 */
export function buildAirtelBlogProductMeta(row: AirtelBlogProductRow): AirtelBlogProductMeta {
  let airtelHotelSummary: string | null = null
  const rawHotel = row.airtelHotelInfoJson?.trim()
  if (rawHotel) {
    try {
      const j = JSON.parse(rawHotel) as unknown
      airtelHotelSummary =
        typeof j === 'object' && j !== null ? JSON.stringify(j).slice(0, 2500) : rawHotel.slice(0, 2500)
    } catch {
      airtelHotelSummary = rawHotel.slice(0, 2500)
    }
  }

  const blob = `${row.title}\n${row.summary ?? ''}\n${row.benefitSummary ?? ''}`
  let flightRouteHint: string | null = null
  if (/직항/.test(blob)) flightRouteHint = '상품 문맥에 직항이 언급됩니다.'
  else if (/경유/.test(blob)) flightRouteHint = '상품 문맥에 경유가 언급됩니다.'
  else if (row.airline?.trim()) flightRouteHint = `등록 항공사 메타: ${row.airline.trim()}`

  return {
    airline: row.airline?.trim() ?? null,
    airportTransferType: row.airportTransferType?.trim() ?? null,
    airtelHotelSummary,
    title: row.title,
    summary: row.summary,
    benefitSummary: row.benefitSummary,
    flightRouteHint,
  }
}

/** 상품 1건의 에어텔 특화 메타 (동기 read) */
export async function extractAirtelBlogMeta(productId: string): Promise<AirtelBlogProductMeta | null> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      summary: true,
      benefitSummary: true,
      airline: true,
      airportTransferType: true,
      airtelHotelInfoJson: true,
    },
  })
  if (!row) return null
  return buildAirtelBlogProductMeta(row)
}
