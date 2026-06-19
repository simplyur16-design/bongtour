/**
 * PR (가)-6.2 — 이벤트 슬롯 2장: Product 도시 ∩ approved CurationEvent (festival/holiday).
 *
 * REGRESSION-FREEZE[trip-recommend-event-slots]: Product 도시·type 필터·기후 중복 제거 — manifest
 */
import { prisma } from '@/lib/prisma'
import {
  buildCountryMatchVariants,
  cityLabelsMatch,
  monthOverlapsEvent,
  resolveRecommendationEventYear,
} from '@/lib/bong-marketing/curation-event-repository'
import { countryLabelsMatch } from '@/lib/bong-marketing/curation-event-gemini-parse'
import {
  matchProductIds,
  monthLabelFromNumber,
  resolveTripDuration,
  rollingMonthsFrom,
  type ProductSummary,
  type TripRecommendationItem,
} from '@/lib/bong-marketing/trip-recommender'

/** 국제 이벤트 type — season/sale/local 성격 제외 (스키마 변경 없음) */
export const EVENT_SLOT_INTERNATIONAL_TYPES = ['festival', 'holiday'] as const

export const EVENT_SLOT_LIMIT = 2

export interface BongtourProductCity {
  country: string
  city: string
  countrySlug: string
  citySlug: string
}

export interface EventSlotClimateCardRef {
  month: number
  city: string
  country: string
}

function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function normalizePlaceKey(city: string, country: string): string {
  return `${city.trim().toLowerCase()}::${country.trim().toLowerCase()}`
}

/** Product 등록 도시·국가 (한글 라벨 + slug) — 중복 제거 */
export async function getBongtourProductCities(): Promise<BongtourProductCity[]> {
  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      autoUnpublishedAt: null,
      city: { not: null },
      country: { not: null },
    },
    select: { country: true, city: true },
    distinct: ['country', 'city'],
  })

  if (!products.length) return []

  const countryKeys = [...new Set(products.map((p) => p.country!).filter(Boolean))]
  const cityKeys = [...new Set(products.map((p) => p.city!).filter(Boolean))]

  const [countryRows, cityRows] = await Promise.all([
    prisma.country.findMany({
      where: { countryKey: { in: countryKeys } },
      select: { countryKey: true, koreanLabel: true },
    }),
    prisma.city.findMany({
      where: { cityKey: { in: cityKeys } },
      select: { cityKey: true, koreanLabel: true },
    }),
  ])

  const countryLabelBySlug = Object.fromEntries(
    countryRows.map((r) => [r.countryKey, r.koreanLabel]),
  )
  const cityLabelBySlug = Object.fromEntries(cityRows.map((r) => [r.cityKey, r.koreanLabel]))

  const seen = new Set<string>()
  const out: BongtourProductCity[] = []

  for (const p of products) {
    const countrySlug = p.country!.trim()
    const citySlug = p.city!.trim()
    const country = countryLabelBySlug[countrySlug] ?? slugToLabel(countrySlug)
    const city = cityLabelBySlug[citySlug] ?? slugToLabel(citySlug)
    const key = `${countrySlug}::${citySlug}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ country, city, countrySlug, citySlug })
  }

  return out.sort((a, b) =>
    a.country.localeCompare(b.country, 'ko') || a.city.localeCompare(b.city, 'ko'),
  )
}

function eventCountryMatchesProduct(
  eventCountryCode: string,
  productCity: BongtourProductCity,
  labelBySlug: Record<string, string>,
): boolean {
  const variants = buildCountryMatchVariants(productCity.country, labelBySlug)
  return variants.some((v) => countryLabelsMatch(v, eventCountryCode))
}

function eventCityMatchesProduct(
  eventCity: string | null,
  productCity: BongtourProductCity,
  cityLabelBySlug: Record<string, string>,
): boolean {
  const productCityLabel = productCity.city
  if (!eventCity?.trim()) return false
  const eventLabel = eventCity.trim()
  if (cityLabelsMatch(productCityLabel, eventLabel)) return true
  const slugLabel = cityLabelBySlug[productCity.citySlug]
  if (slugLabel && cityLabelsMatch(slugLabel, eventLabel)) return true
  return false
}

export function isDuplicateWithClimateCards(
  candidate: { city: string; country: string },
  existingClimateCards: EventSlotClimateCardRef[],
): boolean {
  const key = normalizePlaceKey(candidate.city, candidate.country)
  return existingClimateCards.some(
    (c) => normalizePlaceKey(c.city, c.country) === key,
  )
}

export function pickEventSlotMonth(
  event: { startMonth: number; endMonth: number },
  futureMonths: number[],
): number | null {
  for (const month of futureMonths) {
    if (monthOverlapsEvent(month, event.startMonth, event.endMonth)) return month
  }
  return null
}

interface EventSlotCandidate {
  month: number
  city: string
  country: string
  eventName: string
  appealReason?: string
  eventCity?: string
  eventType: string
}

/** Product 도시 ∩ approved festival/holiday — DB 기반 (Gemini 환각 없음) */
export function matchProductCitiesWithEvents(
  productCities: BongtourProductCity[],
  events: Array<{
    name: string
    countryCode: string
    city: string | null
    startMonth: number
    endMonth: number
    type: string
    appealReason: string | null
    description: string | null
  }>,
  futureMonths: number[],
  countryLabelBySlug: Record<string, string>,
  cityLabelBySlug: Record<string, string>,
): EventSlotCandidate[] {
  const candidates: EventSlotCandidate[] = []
  const seenEventKeys = new Set<string>()

  for (const pc of productCities) {
    for (const ev of events) {
      if (!EVENT_SLOT_INTERNATIONAL_TYPES.includes(ev.type as (typeof EVENT_SLOT_INTERNATIONAL_TYPES)[number])) {
        continue
      }
      if (!eventCountryMatchesProduct(ev.countryCode, pc, countryLabelBySlug)) continue
      if (!eventCityMatchesProduct(ev.city, pc, cityLabelBySlug)) continue

      const month = pickEventSlotMonth(ev, futureMonths)
      if (!month) continue

      const dedupeKey = `${ev.name.trim().toLowerCase()}::${pc.countrySlug}::${pc.citySlug}`
      if (seenEventKeys.has(dedupeKey)) continue
      seenEventKeys.add(dedupeKey)

      candidates.push({
        month,
        city: pc.city,
        country: pc.country,
        eventName: ev.name.trim(),
        appealReason: ev.appealReason?.trim() || ev.description?.trim() || undefined,
        eventCity: ev.city?.trim() || pc.city,
        eventType: ev.type,
      })
    }
  }

  return candidates
}

function eventSlotCandidateToCard(
  candidate: EventSlotCandidate,
  products: ProductSummary[],
  countryLabels: Record<string, string>,
  cityLabels: Record<string, string>,
): TripRecommendationItem {
  const matchingProductIds = matchProductIds(
    { city: candidate.city, country: candidate.country },
    products,
    cityLabels,
    countryLabels,
  )
  const { nights, days } = resolveTripDuration({}, matchingProductIds, products)
  const reason =
    candidate.appealReason?.slice(0, 100) ||
    `${candidate.eventName} 시즌에 방문하기 좋은 도시입니다.`

  return {
    month: candidate.month,
    monthLabel: monthLabelFromNumber(candidate.month),
    city: candidate.city,
    country: candidate.country,
    urgency: '이벤트 시즌',
    reason,
    recommendedTripNights: nights,
    recommendedTripDays: days,
    matchingProductIds,
    themes: ['이벤트'],
    source: 'event',
    events: [
      {
        name: candidate.eventName,
        type: 'global-festival',
        city: candidate.eventCity,
        appealReason: candidate.appealReason,
      },
    ],
    season: undefined,
    monthRange: monthLabelFromNumber(candidate.month),
  }
}

/**
 * 기후 5장과 중복되지 않는 이벤트 슬롯 최대 2장.
 * 후보 없으면 [] — 호출자는 기후 카드만 반환.
 */
export async function findEventSlotCards(params: {
  existingClimateCards: EventSlotClimateCardRef[]
  limit?: number
  referenceDate?: Date
  products?: ProductSummary[]
  countryLabels?: Record<string, string>
  cityLabels?: Record<string, string>
}): Promise<TripRecommendationItem[]> {
  const limit = params.limit ?? EVENT_SLOT_LIMIT
  const referenceDate = params.referenceDate ?? new Date()
  const currentMonth = referenceDate.getMonth() + 1
  const nextMonth = currentMonth >= 12 ? 1 : currentMonth + 1
  const futureMonths = rollingMonthsFrom(nextMonth, 12)

  let productCities: BongtourProductCity[]
  try {
    productCities = await getBongtourProductCities()
  } catch {
    return []
  }
  if (!productCities.length) return []

  const year = referenceDate.getFullYear()
  const eventYears = [
    ...new Set(futureMonths.map((m) => resolveRecommendationEventYear(m, referenceDate))),
  ]

  let events: Array<{
    name: string
    countryCode: string
    city: string | null
    startMonth: number
    endMonth: number
    type: string
    appealReason: string | null
    description: string | null
  }> = []

  try {
    events = await prisma.curationEvent.findMany({
      where: {
        status: 'approved',
        year: { in: eventYears.length ? eventYears : [year, year + 1] },
        type: { in: [...EVENT_SLOT_INTERNATIONAL_TYPES] },
      },
      select: {
        name: true,
        countryCode: true,
        city: true,
        startMonth: true,
        endMonth: true,
        type: true,
        appealReason: true,
        description: true,
      },
    })
  } catch {
    return []
  }

  if (!events.length) return []

  const countryLabelBySlug: Record<string, string> = { ...(params.countryLabels ?? {}) }
  const cityLabelBySlug: Record<string, string> = { ...(params.cityLabels ?? {}) }
  for (const pc of productCities) {
    countryLabelBySlug[pc.countrySlug] = pc.country
    cityLabelBySlug[pc.citySlug] = pc.city
  }

  const matched = matchProductCitiesWithEvents(
    productCities,
    events,
    futureMonths,
    countryLabelBySlug,
    cityLabelBySlug,
  ).filter((c) => !isDuplicateWithClimateCards(c, params.existingClimateCards))

  if (!matched.length) return []

  const products = params.products ?? []
  const countryLabels = params.countryLabels ?? countryLabelBySlug
  const cityLabels = params.cityLabels ?? cityLabelBySlug

  const picked: TripRecommendationItem[] = []
  const usedPlaces = new Set<string>()

  for (const candidate of matched) {
    if (picked.length >= limit) break
    const placeKey = normalizePlaceKey(candidate.city, candidate.country)
    if (usedPlaces.has(placeKey)) continue
    usedPlaces.add(placeKey)
    picked.push(eventSlotCandidateToCard(candidate, products, countryLabels, cityLabels))
  }

  return picked
}
