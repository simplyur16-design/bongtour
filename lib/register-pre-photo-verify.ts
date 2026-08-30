/**
 * 사진 수급 전 검증 — 레인별 등록화면 설정과 일정 키워드·요약이 맞는지 본다.
 * throw 없음. 사진 생성 없음.
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 레인별 검증 스탬프 — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 빈칸·블리드·FIT 공란은 parserFixRequired, 등록대기 금지 — manifest
 * REGRESSION-FREEZE[fit-pre-photo-verify-keywords]: FIT 키워드 공란이면 검증 실패 — manifest
 * REGRESSION-FREEZE[pre-photo-keyword-verify-before-photos]: 키워드가 나와도 검증 통과 전 사진 금지 — manifest
 * REGRESSION-FREEZE[pending-pre-photo-verify-client-safe]: self-heal 서버 체인 import 금지 — manifest
 * REGRESSION-FREEZE[register-hk-gogung-not-taipei-npm]: 홍콩에 대만 국립고궁이면 검증 실패 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: dest hay·FIT 랜드마크 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-identity-country-landmark]: 제목·dest·FIT 요약·같은 날 나라 — manifest
 * REGRESSION-FREEZE[register-pre-photo-city-soft-dup-not-bleed]: 방문도시 반복 ≠ 랜드마크 블리드 — manifest
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — FIT·환승·이동 제외 — manifest
 * REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 트립 템플릿 closer 반복 검증 실패 — manifest
 * REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: 중간일 키워드는 당일 route 명소·도시만 — manifest
 */
import {
  REGISTER_ADMIN_LANE_LABELS,
  canonicalSportsThemeTags,
  type RegisterAdminLane,
} from '@/lib/register-admin-lane'
import {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  tripDaysSharingTemplateCloser,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-guards'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { isAirHotelListingKind, isAirHotelProductType } from '@/lib/air-hotel-product-ssot'
import {
  isAirlineCarrierImageKeyword,
  isBareCityOrCountryKeyword,
  isHotelLodgingImageKeyword,
} from '@/lib/pexels-place-name-keyword'
import {
  isRegisterPrePhotoPlaceLikeDestination,
  isRegisterScheduleCrossContinentHallucinationKeyword,
  isRegisterScheduleSameDayKeywordCountryClash,
  registerPrePhotoPlaceDestHay,
} from '@/lib/register-schedule-cross-continent-keyword-guard'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'
import {
  normScheduleImageKeywordKey,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { firstMatchingScheduleCityEn } from '@/lib/schedule-poi-regex-ssot'
import {
  isOperationalScheduleImageKeyword,
  tryPersistScheduleImageKeyword,
} from '@/lib/schedule-image-keyword-persist'
import {
  collectRouteTextOrderedImageKeywords,
  collectRouteTextOrderedLandmarkKeywords,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'

function ownRouteHasKeyword(routeText: string | null | undefined, keyword: string): boolean {
  const nk = normScheduleImageKeywordKey(keyword)
  if (!nk) return false
  for (const kw of [
    ...collectRouteTextOrderedLandmarkKeywords(routeText),
    ...collectRouteTextOrderedImageKeywords(routeText),
  ]) {
    if (normScheduleImageKeywordKey(kw) === nk) return true
  }
  return false
}

const GENERIC_ROUTE_KW_TOKEN_RE =
  /^(?:national|museum|temple|palace|bridge|castle|island|beach|mountain|cathedral|church|square|garden|street|market|swiss|alps|park|tower|falls|city|town|hotel|resort|airport)$/i

function significantRouteKeywordTokens(raw: string): string[] {
  return String(raw ?? '')
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/u)
    .filter((t) => t.length >= 5 && !GENERIC_ROUTE_KW_TOKEN_RE.test(t))
}

function routeKeywordNormOverlaps(keyword: string, hit: string): boolean {
  const nk = normScheduleImageKeywordKey(keyword)
  const nh = normScheduleImageKeywordKey(hit)
  if (!nk || !nh) return false
  if (nk === nh) return true
  if (nk.length >= 4 && nh.includes(nk)) return true
  if (nh.length >= 4 && nk.includes(nh)) return true
  const kwTok = new Set(significantRouteKeywordTokens(keyword))
  for (const t of significantRouteKeywordTokens(hit)) {
    if (kwTok.has(t)) return true
  }
  return false
}

/** 당일 route에 명소·방문도시가 있는지. 허브·숙소만이면 키워드 일치 강제 안 함. */
// REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: 당일 route 식별 가능해야 일치 강제 — manifest
export function routeTextHasIdentifiableVisitPlace(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (t.length < 2) return false
  if (collectRouteTextOrderedLandmarkKeywords(t).length > 0) return true
  if (collectRouteTextOrderedImageKeywords(t).length > 0) return true
  if (firstMatchingScheduleCityEn(t)) return true
  return false
}

/**
 * 중간일 키워드가 당일 동선(route)의 명소·도시와 맞는지.
 * 이스터섬 날의 Rio, 루체른–베른 날의 Jungfrau 는 false.
 */
// REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: 당일 route 일치 — manifest
export function registerScheduleKeywordMatchesOwnDayRoute(
  routeText: string | null | undefined,
  keyword: string | null | undefined,
): boolean {
  const kw = String(keyword ?? '').trim()
  if (!kw) return true
  if (!routeTextHasIdentifiableVisitPlace(routeText)) return true
  if (ownRouteHasKeyword(routeText, kw)) return true
  const hay = String(routeText ?? '')
  const hits = [
    firstMatchingScheduleCityEn(hay),
    ...collectRouteTextOrderedLandmarkKeywords(hay),
    ...collectRouteTextOrderedImageKeywords(hay),
  ]
  for (const hit of hits) {
    if (hit && routeKeywordNormOverlaps(kw, hit)) return true
  }
  return false
}

const NO_ITINERARY_ROUTE_NOISE_RE = /(?:호텔|리조트|숙박|Hotel|Resort|공항|Airport)/i

/** 상품·일차 제목에 자유일정이 붙어 있을 때만 패키지 추천예시일정 대상. FIT는 이 경로를 쓰지 않는다. */
// REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — manifest
export const REGISTER_FREE_ITINERARY_TITLE_RE = /자유\s*일정|자유일정/

export function productOrDayTitleHasFreeItineraryLabel(
  productTitle?: string | null,
  dayTitle?: string | null,
): boolean {
  return (
    REGISTER_FREE_ITINERARY_TITLE_RE.test(String(productTitle ?? '')) ||
    REGISTER_FREE_ITINERARY_TITLE_RE.test(String(dayTitle ?? ''))
  )
}

/** 환승·경유·공항 이동. 자유일정이 아니다. */
// REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 환승·이동 ≠ 자유일정 — manifest
export function isRegisterScheduleMovementOrTransitDay(row: RegisterPrePhotoHealRow): boolean {
  const hay = [row.title, row.description, row.routeText].filter(Boolean).join('\n')
  if (
    /환승|경유|이동\s*(?:일|만|중심)|출국|귀국편|귀국일|비행기|항공\s*이동|layover|transit/i.test(
      hay,
    )
  ) {
    return true
  }
  const placeSegs = [...splitRouteTextPlaceSegments(row.title), ...splitRouteTextPlaceSegments(row.routeText)]
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .filter((s) => !REGISTER_FREE_ITINERARY_TITLE_RE.test(s) && !isHotelLodgingImageKeyword(s))
  const cities = new Set<string>()
  for (const seg of placeSegs) {
    const city = firstMatchingScheduleCityEn(seg)
    if (city) cities.add(normScheduleImageKeywordKey(city))
  }
  const hasTourismActivity = /관광|투어|박물관|사원|궁전|광장|폭포|유적|국립공원|방문/u.test(hay)
  if (cities.size >= 2 && !hasTourismActivity) return true
  return (
    placeSegs.length >= 2 &&
    /공항|Airport|두바이|Dubai|도하|Doha|인천|김포/i.test(hay)
  )
}

/**
 * 패키지 — 제목에 자유일정이 있고, 환승·이동이 아니며, 그날 관광 동선이 비어 있으면 추천예시일정 대상.
 * FIT 레인에서는 호출하지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — manifest
 */
export function isRegisterPendingFreeItineraryDay(
  row: RegisterPrePhotoHealRow,
  opts?: { productTitle?: string | null },
): boolean {
  if (isRegisterScheduleMovementOrTransitDay(row)) return false
  if (!productOrDayTitleHasFreeItineraryLabel(opts?.productTitle, row.title)) return false
  if (collectRouteTextOrderedLandmarkKeywords(row.routeText).length > 0) return false
  if (collectRouteTextOrderedLandmarkKeywords(row.description).length > 0) return false
  const tourismSegs = splitRouteTextPlaceSegments(row.routeText)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .filter((s) => !isHotelLodgingImageKeyword(s) && !NO_ITINERARY_ROUTE_NOISE_RE.test(s))
  return tourismSegs.length <= 1
}

/** 제목에 추천일정(반나절·1day)이 있고 동선에 관광 스팟이 있으면 제미나이 추천일정이 들어간 것이다. */
export function hasRegisterFreeDayRecommendedItinerary(row: RegisterPrePhotoHealRow): boolean {
  if (!/추천일정/.test(String(row.title ?? ''))) return false
  if (collectRouteTextOrderedLandmarkKeywords(row.routeText).length > 0) return true
  const segs = splitRouteTextPlaceSegments(row.routeText)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .filter((s) => !isHotelLodgingImageKeyword(s) && !NO_ITINERARY_ROUTE_NOISE_RE.test(s))
  return segs.length >= 2
}

export const REGISTER_PRE_PHOTO_RAW_META_KEY = 'prePhoto'

export type RegisterPrePhotoVerifyIssue = string

export type RegisterPrePhotoVerifyResult = {
  lane: RegisterAdminLane
  laneLabel: string
  ok: boolean
  readyForOperatorPhoto: boolean
  parserFixRequired: boolean
  issues: RegisterPrePhotoVerifyIssue[]
}

export type RegisterPrePhotoRawMetaStamp = RegisterPrePhotoVerifyResult & {
  verifiedAt: string
}

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const parsed = JSON.parse(rawMeta) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function packageScheduleIssues(
  rows: readonly RegisterPrePhotoHealRow[],
  productTitle?: string | null,
): RegisterPrePhotoVerifyIssue[] {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) {
    issues.push('schedule_empty')
    return issues
  }
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  for (const row of days) {
    const day = Number(row.day)
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword)) {
      issues.push(`day${day}_keyword_lodging_or_non_landmark`)
    }
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword2)) {
      issues.push(`day${day}_keyword2_lodging_or_non_landmark`)
    }
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (
      slot === 'middle' &&
      isRegisterPendingFreeItineraryDay(row, { productTitle }) &&
      !hasRegisterFreeDayRecommendedItinerary(row)
    ) {
      issues.push(`day${day}_free_recommended_itinerary_missing`)
    }
    if (slot === 'middle' && !String(row.imageKeyword ?? '').trim()) {
      issues.push(`day${day}_middle_keyword_empty`)
    }
    if (
      slot === 'middle' &&
      String(row.imageKeyword ?? '').trim() &&
      !registerScheduleKeywordMatchesOwnDayRoute(row.routeText, row.imageKeyword)
    ) {
      issues.push(`day${day}_keyword_not_on_own_route`)
    }
    if (
      slot === 'middle' &&
      String(row.imageKeyword2 ?? '').trim() &&
      !registerScheduleKeywordMatchesOwnDayRoute(row.routeText, row.imageKeyword2)
    ) {
      issues.push(`day${day}_keyword2_not_on_own_route`)
    }
    if (
      !isRegisterPendingFreeItineraryDay(row, { productTitle }) &&
      isBrokenRegisterScheduleDescription(row.description, row.routeText)
    ) {
      issues.push(`day${day}_description_filler_or_duplicate`)
    }
  }
  for (const day of tripDaysSharingTemplateCloser(days)) {
    issues.push(`day${day}_description_repeated_closer`)
  }
  const seenKw = new Map<string, number>()
  for (const row of days) {
    const slot = resolveScheduleKeywordSlotKind(
      Number(row.day),
      maxDay,
      activeDays,
    )
    if (slot !== 'middle') continue
    const key = normScheduleImageKeywordKey(String(row.imageKeyword ?? '').trim())
    if (!key) continue
    const prev = seenKw.get(key)
    if (prev != null) {
      // 리조트·시내 자유일 — 같은 방문도시 반복은 랜드마크 블리드가 아님
      // 당일 route에 같은 명소가 있으면 반복도 블리드가 아님
      const ownHas = ownRouteHasKeyword(row.routeText, String(row.imageKeyword ?? ''))
      if (!isBareCityOrCountryKeyword(String(row.imageKeyword ?? '')) && !ownHas) {
        issues.push(`day${row.day}_keyword_bleed_other_day`)
      }
    } else {
      seenKw.set(key, Number(row.day))
    }
  }
  for (const row of days) {
    if (isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) {
      issues.push(`day${row.day}_keyword_same_day_country_clash`)
    }
  }
  return issues
}

function pushFilledKeywordQualityIssues(
  issues: RegisterPrePhotoVerifyIssue[],
  day: number,
  field: 'keyword' | 'keyword2',
  raw: string,
): void {
  if (isOperationalScheduleImageKeyword(raw)) {
    issues.push(`day${day}_${field}_operational_placeholder`)
    return
  }
  if (isAirlineCarrierImageKeyword(raw)) {
    issues.push(`day${day}_${field}_airline`)
    return
  }
  if (!tryPersistScheduleImageKeyword(raw).ok) {
    issues.push(`day${day}_${field}_not_persistable`)
  }
}

function fitScheduleIssues(
  rows: readonly RegisterPrePhotoHealRow[],
  productTitle?: string | null,
): RegisterPrePhotoVerifyIssue[] {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) {
    issues.push('schedule_empty')
    return issues
  }
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  let anyKeyword = false
  for (const row of days) {
    const day = Number(row.day)
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (kw) anyKeyword = true
    if (kw) {
      pushFilledKeywordQualityIssues(issues, day, 'keyword', kw)
      if (isBrokenRegisterLandmarkKeyword(kw, { allowHotelLodging: true })) {
        issues.push(`day${day}_keyword_lodging_or_non_landmark`)
      }
    }
    if (kw2) {
      pushFilledKeywordQualityIssues(issues, day, 'keyword2', kw2)
      if (isBrokenRegisterLandmarkKeyword(kw2, { allowHotelLodging: true })) {
        issues.push(`day${day}_keyword2_lodging_or_non_landmark`)
      }
    }
    if (kw && kw2 && normScheduleImageKeywordKey(kw) === normScheduleImageKeywordKey(kw2)) {
      issues.push(`day${day}_keyword_same_as_keyword2`)
    }
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (
      slot === 'middle' &&
      kw &&
      !registerScheduleKeywordMatchesOwnDayRoute(row.routeText, kw)
    ) {
      issues.push(`day${day}_keyword_not_on_own_route`)
    }
    if (
      slot === 'middle' &&
      kw2 &&
      !registerScheduleKeywordMatchesOwnDayRoute(row.routeText, kw2)
    ) {
      issues.push(`day${day}_keyword2_not_on_own_route`)
    }
    if (
      !isRegisterPendingFreeItineraryDay(row, { productTitle }) &&
      isBrokenRegisterScheduleDescription(row.description, row.routeText)
    ) {
      issues.push(`day${day}_description_filler_or_duplicate`)
    }
  }
  for (const day of tripDaysSharingTemplateCloser(days)) {
    issues.push(`day${day}_description_repeated_closer`)
  }
  if (!anyKeyword) {
    issues.push('fit_keyword_empty')
  }
  const seenKw = new Map<string, number>()
  for (const row of days) {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') continue
    const key = normScheduleImageKeywordKey(String(row.imageKeyword ?? '').trim())
    if (!key) continue
    const prev = seenKw.get(key)
    if (prev != null) {
      const ownHas = ownRouteHasKeyword(row.routeText, String(row.imageKeyword ?? ''))
      if (!isBareCityOrCountryKeyword(String(row.imageKeyword ?? '')) && !ownHas) {
        issues.push(`day${row.day}_keyword_bleed_other_day`)
      }
    } else {
      seenKw.set(key, Number(row.day))
    }
  }
  for (const row of days) {
    if (isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) {
      issues.push(`day${row.day}_keyword_same_day_country_clash`)
    }
  }
  return issues
}

// REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 마카오·남미 dest 제목 추론 — manifest
const DEST_FROM_TITLE_RE =
  /울란바토르|몽골|도쿄|동경|오사카|다낭|푸꾸옥|하와이|파리|런던|후쿠오카|오키나와|사이판|발리|홍콩|마카오|세부|보라카이|이집트|영국|스위스|이태리|이탈리아|스페인|포르투갈|폴란드|괌|중남미|(?<![가-힣])남미|시드니|코카서스|튀니지|서안|호이안|바나|위해|미서부|토스카나|보르도|두바이|아부다비/

/** dest 미지정·항공권 등 비장소일 때만 — 제목에 나온 지명을 dest로 쓴다. 제목은 지어내지 않는다. */
// REGRESSION-FREEZE[register-pre-photo-city-soft-dup-not-bleed]: dest 미지정은 제목에서만 추론 — manifest
export function inferRegisterPendingDestinationFromTitle(title: string): string {
  const m = String(title ?? '').match(DEST_FROM_TITLE_RE)
  if (!m) return ''
  if (m[0] === '동경') return '도쿄'
  if (m[0] === '이태리' || m[0] === '토스카나') return '이탈리아'
  if (m[0] === '남미') return '중남미'
  if (m[0] === '마카오') return '마카오'
  return m[0]
}

function productIdentityIssues(
  productTitle?: string | null,
  productDestination?: string | null,
): RegisterPrePhotoVerifyIssue[] {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const title = String(productTitle ?? '').trim()
  const dest = String(productDestination ?? '').trim()
  if (isSupplierListingTitleUnacceptable(title)) issues.push('title_placeholder')
  const destLine = dest.split(/\n/)[0]?.trim() ?? ''
  if (/^(?:미입력|미지정|미정|상품명 없음)$/i.test(destLine)) {
    issues.push('destination_placeholder')
  } else if (!dest && isSupplierListingTitleUnacceptable(title)) {
    issues.push('destination_placeholder')
  } else if (dest && !isRegisterPrePhotoPlaceLikeDestination(dest) && isSupplierListingTitleUnacceptable(title)) {
    issues.push('destination_placeholder')
  }
  return issues
}

function wrongCountryKeywordIssues(
  rows: readonly RegisterPrePhotoHealRow[],
  productDestination?: string | null,
  productTitle?: string | null,
): RegisterPrePhotoVerifyIssue[] {
  const destHay = registerPrePhotoPlaceDestHay(productDestination, productTitle)
  if (!destHay) return []
  const issues: RegisterPrePhotoVerifyIssue[] = []
  for (const row of rows) {
    const day = Number(row.day)
    if (day <= 0) continue
    if (isRegisterScheduleCrossContinentHallucinationKeyword(row.imageKeyword, destHay, rows)) {
      issues.push(`day${day}_keyword_wrong_country`)
    }
    if (isRegisterScheduleCrossContinentHallucinationKeyword(row.imageKeyword2, destHay, rows)) {
      issues.push(`day${day}_keyword2_wrong_country`)
    }
  }
  return issues
}

export function isRegisterPrePhotoParserFixIssue(issue: string): boolean {
  return (
    issue.includes('lodging_or_non_landmark') ||
    issue.includes('middle_keyword_empty') ||
    issue.includes('free_recommended_itinerary_missing') ||
    issue.includes('keyword_bleed_other_day') ||
    issue.includes('fit_keyword_empty') ||
    issue.includes('not_persistable') ||
    issue.includes('_airline') ||
    issue.includes('operational_placeholder') ||
    issue.includes('keyword_same_as_keyword2') ||
    issue.includes('wrong_country') ||
    issue.includes('not_on_own_route') ||
    issue.includes('same_day_country_clash') ||
    issue.includes('title_placeholder') ||
    issue.includes('destination_placeholder') ||
    issue.includes('description_filler_or_duplicate') ||
    issue.includes('description_repeated_closer') ||
    issue === 'schedule_empty'
  )
}

export function scheduleRowsForPrePhotoVerify(schedule: string | null | undefined): RegisterPrePhotoHealRow[] {
  if (!schedule?.trim()) return []
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => {
      const row = item as Record<string, unknown>
      return {
        day: Number(row.day) || 0,
        title: row.title != null ? String(row.title) : null,
        description: row.description != null ? String(row.description) : null,
        routeText: row.routeText != null ? String(row.routeText) : null,
        imageKeyword: row.imageKeyword != null ? String(row.imageKeyword) : null,
        imageKeyword2: row.imageKeyword2 != null ? String(row.imageKeyword2) : null,
        imageUrl: row.imageUrl != null ? String(row.imageUrl) : null,
      }
    })
  } catch {
    return []
  }
}

export function verifyRegisterPrePhoto(args: {
  lane: RegisterAdminLane
  listingKind?: string | null
  productType?: string | null
  sportsThemeTag?: readonly string[] | null
  productDestination?: string | null
  productTitle?: string | null
  rows: readonly RegisterPrePhotoHealRow[]
}): RegisterPrePhotoVerifyResult {
  const issues: RegisterPrePhotoVerifyIssue[] = []
  const { lane } = args
  issues.push(...productIdentityIssues(args.productTitle, args.productDestination))

  if (lane === 'air_hotel_free') {
    if (!isAirHotelListingKind(args.listingKind) && !isAirHotelProductType(args.productType)) {
      issues.push('fit_listingKind_mismatch')
    }
    issues.push(...fitScheduleIssues(args.rows, args.productTitle))
  } else {
    if (isAirHotelListingKind(args.listingKind) || isAirHotelProductType(args.productType)) {
      issues.push('package_listingKind_is_fit')
    }
    issues.push(...packageScheduleIssues(args.rows, args.productTitle))
  }
  issues.push(
    ...wrongCountryKeywordIssues(args.rows, args.productDestination, args.productTitle),
  )

  if (lane === 'theme' && canonicalSportsThemeTags(args.sportsThemeTag).length === 0) {
    issues.push('theme_tag_missing')
  }

  const ok = issues.length === 0
  const parserFixRequired = issues.some(isRegisterPrePhotoParserFixIssue)
  return {
    lane,
    laneLabel: REGISTER_ADMIN_LANE_LABELS[lane],
    ok,
    readyForOperatorPhoto: ok,
    parserFixRequired,
    issues,
  }
}

export function mergeRegisterPrePhotoStampIntoRawMeta(
  rawMeta: string | null | undefined,
  stamp: RegisterPrePhotoVerifyResult,
  verifiedAt = new Date().toISOString(),
): string {
  const obj = parseRawMetaObject(rawMeta)
  obj[REGISTER_PRE_PHOTO_RAW_META_KEY] = {
    ...stamp,
    verifiedAt,
  } satisfies RegisterPrePhotoRawMetaStamp
  return JSON.stringify(obj)
}

export function readRegisterPrePhotoStampFromRawMeta(
  rawMeta: string | null | undefined,
): RegisterPrePhotoRawMetaStamp | null {
  const raw = parseRawMetaObject(rawMeta)[REGISTER_PRE_PHOTO_RAW_META_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const lane = o.lane
  if (lane !== 'package' && lane !== 'air_hotel_free' && lane !== 'theme') return null
  return {
    lane,
    laneLabel: typeof o.laneLabel === 'string' ? o.laneLabel : REGISTER_ADMIN_LANE_LABELS[lane],
    ok: o.ok === true,
    readyForOperatorPhoto: o.readyForOperatorPhoto === true,
    parserFixRequired: o.parserFixRequired === true || (Array.isArray(o.issues) && o.issues.some((x) => isRegisterPrePhotoParserFixIssue(String(x)))),
    issues: Array.isArray(o.issues) ? o.issues.map((x) => String(x)) : [],
    verifiedAt: typeof o.verifiedAt === 'string' ? o.verifiedAt : '',
  }
}
