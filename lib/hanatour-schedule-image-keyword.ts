/**
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]: 자유여행 imageKeyword — 식당·카페 금지, 랜드마크만 — manifest
 * REGRESSION-FREEZE[hanatour-register-kk-live-gate]: dedupe·imageKeyword2 reconcile — manifest
 * REGRESSION-FREEZE[hanatour-register-schedule-image-keyword-apply]: routeText 일차 슬롯 allocate — manifest
 * REGRESSION-FREEZE[gemini-client-client-bundle]: hanatour 등록 파서 import 금지 — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: POI regex — schedule-poi-regex-ssot SSOT — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-adjacent-poi]: D1·기내박·귀국 — 인접일 미사용 관광명소·공항 금지 — manifest
 * REGRESSION-FREEZE[register-schedule-day-owned-image-keyword]: 당일 routeText 우선 — 타 일차 landmark 금지 — manifest
 */
import {
  classifyHanatourScheduleCardDayKind,
  type HanatourScheduleCardDayKind,
} from '@/lib/hanatour-schedule-card-day-kind'
import {
  acceptLlmScheduleImageKeyword,
  englishFromScheduleKoreanSegment,
  inferEnglishPlaceKeywordFromDayContent,
  pickDistinctSecondScheduleImageKeyword,
  resolveTourismKeywordPreferDistinctPerDay,
  shouldReconcileScheduleImageKeyword2,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  findAllScheduleSpotMatchesInText,
  firstMatchingScheduleSpotEn,
  getSchedulePoiRegexEnglishKeys,
  SCHEDULE_SPOT_KO_REGEX_RULES,
} from '@/lib/schedule-poi-regex-ssot'
import {
  extractEnglishPoiFromLabel,
  findAllMappedKoreanPoisInText,
  findMappedKoreanPoisInTextByMentionOrder,
  isKnownDestinationCityEnglishKeyword,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
  isDestinationMapEnglishHubKeyword,
} from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isAirlineCarrierImageKeyword,
  isHotelLodgingImageKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkRouteTextSegment,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
  isScheduleImageKeywordLandmarkEligible,
  isWeakOpaqueImageKeyword,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'
import { isRegisterScheduleRoutePlaceNoise, isRegisterScheduleAirlineRouteSegment } from '@/lib/register-schedule-route-place-noise'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'

import {
  acceptScheduleTourismImageKeywordOrEmpty,
  pickDistinctScheduleRouteSecondKeyword,
  fillScheduleMiddleImageKeyword2Gap,
  isScheduleAirportLikeImageKeyword,
  isScheduleAirportOnlyRouteText,
  isScheduleAirportRouteSegmentText,
  isScheduleInFlightOvernightRow,
  pickUnusedScheduleImageKeywordFromAdjacentDays,
  resolveScheduleKeywordSlotKind,
  shouldFillScheduleMiddleKeyword2Gap,
  type ScheduleAdjacentDayAlloc,
} from '@/lib/schedule-image-keyword-adjacent-poi'

export type HanatourScheduleImageKeywordOpts = {
  productDestination?: string | null
  /** 패키지 자유관광일 — 선택관광 카탈로그에서 예시 imageKeyword */
  optionalTourNames?: readonly string[]
  /** detailBody schedule_section 일차별 원문 — row.description이 빈약할 때 명소 추출용 */
  scheduleSectionByDay?: ReadonlyMap<number, string> | null
}

export type HanatourScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const FOREIGN_AIRPORT_KW_RE =
  /^(?:New\s+Chitose|Chitose|Narita|Haneda|Kansai|Nagoya|Fukuoka|Naha|CTS|NRT|HND|KIX|NGO|FUK|OKA)(?:\s+[Aa]irport)?$/i

const FOREIGN_AIRPORT_ROUTE_RE =
  /신치토세|新千歲|Chitose|나리타|Narita|간사이|Kansai|하네다|Haneda|나고야\s*공항|Nagoya\s*Airport|후쿠오카\s*공항|Fukuoka\s*Airport|那覇|Naha|CTS|NRT|HND|KIX/i

/** 아시아·태평양 목적지 — 타대륙 유명 랜드마크 환각 차단 대상 */
const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const HANATOUR_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const HANATOUR_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

/** LLM이 아시아 상품에 헛생성하는 유럽·중국 고정 랜드마크(최소 블랙리스트) */
const CROSS_CONTINENT_HALLUCINATION_KW_RES: ReadonlyArray<RegExp> = [
  /\bParis\b/i,
  /\bEiffel\b/i,
  /\bLouvre\b/i,
  /Notre\s*Dame/i,
  /\bColosseum\b/i,
  /\bRome\b/i,
  /Forbidden(\s*City)?/i,
  /Big\s*Ben/i,
  /London\s*Eye/i,
  /Tower\s*of\s*London/i,
  /\bBarcelona\b/i,
  /Sagrada\s*Familia/i,
  /\bAmsterdam\b/i,
  /\bVenice\b/i,
  /Brandenburg/i,
  /\bMunich\b/i,
  /Arc\s*de\s*Triomphe/i,
  /Versailles/i,
]

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function keysEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  return normKey(a) === normKey(b)
}

const HANATOUR_SSOT_POI_EN_KEYS = getSchedulePoiRegexEnglishKeys()

function isHanatourSsotPoiEnglishKeyword(kw: string): boolean {
  return HANATOUR_SSOT_POI_EN_KEYS.has(normKey(String(kw ?? '').trim()))
}

let activeHanatourScheduleSectionByDay: ReadonlyMap<number, string> | null = null

function buildHanatourDayHaystack(
  row: HanatourScheduleImageKeywordRow,
  scheduleSectionByDay: ReadonlyMap<number, string> | null = activeHanatourScheduleSectionByDay,
): string {
  const day = Number(row.day)
  const section =
    scheduleSectionByDay && day > 0 ? String(scheduleSectionByDay.get(day) ?? '').trim() : ''
  return [section, row.title, row.description, row.routeText].filter(Boolean).join('\n').replace(/\r/g, '')
}

/** 하나투어 자유관광일 — "자유롭게 관광" 등 본문 패턴 포함 */
export function isHanatourScheduleFreeLeisureDay(haystack: string): boolean {
  const h = String(haystack ?? '').slice(0, 8_000)
  if (!h.trim()) return false
  if (!/전\s*일정\s*자유|자유\s*시간|자유\s*일정|자유일정|free\s*time|at\s+leisure/i.test(h)) return false
  if (/자유(?:롭게|롭게)?\s*관광|자유\s*관광/u.test(h)) return true
  if (/(방문|탐방|투어|체험|국립|공원|사원|유적|박물관|폭포|섬)/u.test(h)) return false
  if (/관광/u.test(h)) return false
  return true
}

function scoreHanatourOptionalTourNameForExampleKeyword(name: string): number {
  let score = 0
  if (/MD추천|스페셜포함/.test(name)) score += 2
  if (mapKoreanPoiSegment(name) || extractEnglishPoiFromLabel(name)) score += 3
  if (/섬|아일랜드|공원|투어|폭포|크루즈|사원|유적|폭포/.test(name)) score += 1
  if (/마사지|발마사지|라운지|골프|쇼핑/.test(name) && !/(섬|아일랜드|공원)/.test(name)) score -= 2
  return score
}

/** 하나투어 자유관광일 — 선택관광 카탈로그에서 예시 랜드마크 1개 */
export function pickHanatourFreeDayExampleImageKeyword(args: {
  optionalTourNames: readonly string[]
  freeDayIndex: number
  usedKeys?: ReadonlySet<string>
  toKeyword: (name: string) => string
}): string {
  const used = args.usedKeys ?? new Set<string>()
  const sorted = [...args.optionalTourNames]
    .map((n) => String(n).trim())
    .filter((n) => n.length > 1)
    .sort(
      (a, b) =>
        scoreHanatourOptionalTourNameForExampleKeyword(b) -
        scoreHanatourOptionalTourNameForExampleKeyword(a),
    )

  const candidates: string[] = []
  for (const name of sorted) {
    const kw = args.toKeyword(name)
    if (!kw) continue
    const nk = normKey(kw)
    if (used.has(nk)) continue
    candidates.push(kw)
  }
  if (!candidates.length) return ''
  const idx = Math.max(0, Math.min(args.freeDayIndex, candidates.length - 1))
  return candidates[idx]!
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 인천·부산·대구·청주·김포·ICN/GMP 등 — imageKeyword 후보에서 제외 */
export function isHanatourDomesticHubToken(token: string): boolean {
  const t = stripRouteSegmentNoise(token)
  if (!t) return true
  if (DOMESTIC_HUB_KO_RE.test(t)) return true
  if (DOMESTIC_HUB_EN_RE.test(t)) return true
  if (/^인천(?:국제)?공항$/u.test(t)) return true
  if (/^김포(?:국제)?공항$/u.test(t)) return true
  if (/^부산(?:국제)?공항$/u.test(t)) return true
  if (/^대구(?:국제)?공항$/u.test(t)) return true
  if (/^청주(?:국제)?공항$/u.test(t)) return true
  return false
}

/** 해외 공항·허브 — 관광 imageKeyword 1순위로 쓰지 않음(당일 숙박·관광지 우선) */
export function isHanatourForeignAirportImageKeyword(keyword: string): boolean {
  const k = String(keyword ?? '').trim()
  if (!k) return false
  if (FOREIGN_AIRPORT_KW_RE.test(k)) return true
  return /\bairport\b/i.test(k)
}

function isHanatourForeignAirportRouteSegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isHanatourDomesticHubToken(t)) return false
  if (FOREIGN_AIRPORT_ROUTE_RE.test(t)) return true
  if (/(?:국제)?\s*공항$/u.test(t)) return true
  return false
}

function findHanatourKoPoiEn(text: string): string {
  const hits = findAllScheduleSpotMatchesInText(text)
  return hits[0]?.en ?? ''
}

function routeTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText).map(stripRouteSegmentNoise).filter((s) => s.length >= 2)
}

function isLatinRoutePlaceSegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t || t.length < 2) return false
  if (/[가-힣]/.test(t)) return false
  if (/[\u4e00-\u9fff]/.test(t)) return false
  return t.replace(/[^A-Za-z]/g, '').length >= 3
}

/** LLM 1순위 imageKeyword 형식 — 라틴·1~10단어·toxic/한글/일정노이즈 제외 (단일 도시명 허용) */
function isHanatourLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 3 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (HANATOUR_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (HANATOUR_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (isNonLandmarkFoodOrDiningImageKeyword(k)) return false
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(k)) return false
  if (isAirlineCarrierImageKeyword(k)) return false
  if (isBlockedScheduleImageKeyword(k)) return false
  if (isHotelLodgingImageKeyword(k)) return false
  if (isWeakOpaqueImageKeyword(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

/** 아시아·태평양 목적지 상품에서 LLM이 헛생성한 타대륙 유명 랜드마크 */
export function isHanatourCrossContinentHallucinationKeyword(
  keyword: string,
  productDestination: string | null | undefined,
): boolean {
  const dest = String(productDestination ?? '').trim()
  if (!dest || !ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest)) return false
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  const fin = normalizeToPlaceName(raw)
  const haystacks = fin && fin !== raw ? [raw, fin] : [raw]
  return CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))
}

/** routeText 세그먼트에서 괄호·라틴 영문만 추출(매핑 없음) */
function extractLatinEnglishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isHanatourDomesticHubToken(t)) return ''
  const paren = t.match(/\(\s*([A-Za-z][A-Za-z0-9\s,.'-]{2,62})\s*\)/)
  if (paren?.[1]) {
    try {
      return finalizeScheduleImageKeyword(paren[1])
    } catch {
      return ''
    }
  }
  if (isLatinRoutePlaceSegment(t)) {
    try {
      return finalizeScheduleImageKeyword(t)
    } catch {
      return ''
    }
  }
  return ''
}

function englishFromKoreanRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isHanatourDomesticHubToken(t)) return ''
  const fromHanatourPoi = findHanatourKoPoiEn(t)
  if (fromHanatourPoi) {
    try {
      return finalizeScheduleImageKeyword(fromHanatourPoi)
    } catch {
      /* continue */
    }
  }
  return englishFromScheduleKoreanSegment(t)
}

/** routeText 전 구간 — primary와 다른 첫 수용 가능 장소(이동 순서) */
function pickDistinctPlaceFromRouteText(
  routeText: string | null | undefined,
  primary: string,
  productDestination: string | null | undefined,
): string {
  const primaryNk = normKey(primary)
  for (const seg of routeTextSegments(routeText)) {
    if (isHanatourDomesticHubToken(seg)) continue
    if (isRegisterScheduleRoutePlaceNoise(seg) || isNonLandmarkRouteTextSegment(seg)) continue
    const kw = acceptScheduleTourismImageKeywordOrEmpty(
      hanatourRouteSegmentToImageKeyword(seg, productDestination),
    )
    if (kw && normKey(kw) !== primaryNk) return kw
  }
  return ''
}

function isHanatourBareCityKeyword(kw: string): boolean {
  const k = String(kw ?? '').trim()
  if (!k) return true
  if (isHanatourSsotPoiEnglishKeyword(k)) return false
  if (isHanatourForeignAirportImageKeyword(k)) return true
  if (isKnownDestinationCityEnglishKeyword(k)) return true
  if (isDestinationMapEnglishHubKeyword(k)) return true
  return false
}

/** 본문·routeText에서 관광명소만 일정 등장 순(본문 POI → route 구간) */
function collectHanatourOrderedScheduleLandmarks(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const haystack = buildHanatourDayHaystack(row)
  const push = (raw: string | null | undefined) => {
    const kw = String(raw ?? '').trim()
    if (!kw || isHanatourBareCityKeyword(kw)) return
    if (out.some((x) => normKey(x) === normKey(kw))) return
    out.push(kw)
  }

  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(haystack)) {
    push(tryAcceptHanatourMappedPoiKeyword(en, productDestination))
  }
  const koPoiHits = findAllScheduleSpotMatchesInText(haystack)
  for (const { en } of koPoiHits) {
    push(tryAcceptHanatourMappedPoiKeyword(en, productDestination))
  }

  for (const seg of routeTextSegments(row.routeText)) {
    if (isHanatourDomesticHubToken(seg)) continue
    if (isHanatourForeignAirportRouteSegment(seg)) continue
    push(hanatourLandmarkFromRouteSegment(seg, haystack, productDestination))
  }

  return out
}

function hanatourLandmarkFromRouteSegment(
  seg: string,
  haystack: string,
  productDestination: string | null | undefined,
): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isHanatourDomesticHubToken(t) || isHanatourForeignAirportRouteSegment(t)) return ''

  for (const { re, en } of SCHEDULE_SPOT_KO_REGEX_RULES) {
    if (!re.test(haystack)) continue
    if (re.test(t) || re.test(seg) || (t.length >= 2 && haystack.includes(t))) {
      const kw = tryAcceptHanatourMappedPoiKeyword(en, productDestination)
      if (kw && !isHanatourBareCityKeyword(kw)) return kw
    }
  }

  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    const kw = tryAcceptHanatourMappedPoiKeyword(fromPoi, productDestination)
    if (kw && !isHanatourBareCityKeyword(kw)) return kw
  }

  const latin = extractLatinEnglishFromRouteSegment(t)
  if (latin) {
    const kw = tryAcceptHanatourLlmImageKeyword(latin, productDestination)
    if (kw && !isHanatourBareCityKeyword(kw)) return kw
  }

  return ''
}

function pickFirstUnusedHanatourScheduleLandmark(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
  usedPrimary?: Set<string>,
): string {
  for (const kw of collectHanatourOrderedScheduleLandmarks(row, productDestination)) {
    const nk = normKey(kw)
    if (usedPrimary?.has(nk)) continue
    usedPrimary?.add(nk)
    return kw
  }
  return ''
}

function commitHanatourPrimaryKeyword(
  kw: string,
  dayKind: HanatourScheduleCardDayKind,
  usedPrimary?: Set<string>,
): string {
  const k = String(kw ?? '').trim()
  if (!k) return ''
  if (dayKind !== 'return_home' && usedPrimary) usedPrimary.add(normKey(k))
  return k
}

function pushUniqueHanatourLandmark(
  list: string[],
  raw: string,
  productDestination: string | null | undefined,
): void {
  const kw = tryAcceptHanatourMappedPoiKeyword(raw, productDestination)
  if (!kw) return
  const nk = normKey(kw)
  if (list.some((x) => normKey(x) === nk)) return
  list.push(kw)
}

/** routeText 전 구간 + 본문 한글 POI — 이동 순서·중복 제거 */
function collectHanatourLandmarkKeywords(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  for (const seg of routeTextSegments(row.routeText)) {
    if (isHanatourDomesticHubToken(seg)) continue
    if (isNonLandmarkRouteTextSegment(seg)) continue
    const kw = segmentToAcceptedHanatourKeyword(seg, productDestination)
    if (kw) pushUniqueHanatourLandmark(out, kw, productDestination)
  }
  const haystack = buildHanatourDayHaystack(row)
  for (const en of findAllMappedKoreanPoisInText(haystack)) {
    pushUniqueHanatourLandmark(out, en, productDestination)
  }
  for (const { re, en } of SCHEDULE_SPOT_KO_REGEX_RULES) {
    if (re.test(haystack)) pushUniqueHanatourLandmark(out, en, productDestination)
  }
  return out
}

function collectHanatourTripLandmarkCandidates(
  rows: HanatourScheduleImageKeywordRow[],
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const sorted = [...rows].filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  for (const row of sorted) {
    for (const kw of collectHanatourOrderedScheduleLandmarks(row, productDestination)) {
      const nk = normKey(kw)
      if (!nk || out.some((x) => normKey(x) === nk)) continue
      out.push(kw)
    }
  }
  return out
}

/** 본문·제목·schedule_section에 매핑된 명소가 있으면 도시명만인 LLM 1순위보다 우선(본문 등장 순) */
function preferPoiOverBareCityLlm(
  row: HanatourScheduleImageKeywordRow,
  acceptedCity: string,
  productDestination: string | null | undefined,
): string {
  const bodyHaystack = buildHanatourDayHaystack(row)
  for (const { re, en } of SCHEDULE_SPOT_KO_REGEX_RULES) {
    if (!re.test(bodyHaystack)) continue
    const kw = tryAcceptHanatourMappedPoiKeyword(en, productDestination)
    if (kw && normKey(kw) !== normKey(acceptedCity)) return kw
  }
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(bodyHaystack)) {
    const kw = tryAcceptHanatourMappedPoiKeyword(en, productDestination)
    if (kw && normKey(kw) !== normKey(acceptedCity)) return kw
  }
  return acceptedCity
}

function tryAcceptHanatourLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  return acceptLlmScheduleImageKeyword(raw, {
    productDestination,
    isFormatOk: isHanatourLlmImageKeywordFormatOk,
    isDomesticHub: isHanatourDomesticHubToken,
    isCrossContinentHallucination: isHanatourCrossContinentHallucinationKeyword,
  })
}

/** schedule-poi-regex-ssot + POI_KO_TO_EN — 짧은 도시명(Otaru 등) weak-opaque 우회 */
function tryAcceptHanatourMappedPoiKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  const accepted = tryAcceptHanatourLlmImageKeyword(raw, productDestination)
  if (accepted) return accepted
  const fin = String(raw ?? '').trim()
  if (!fin) return ''
  if (isHanatourSsotPoiEnglishKeyword(fin)) {
    if (isHanatourCrossContinentHallucinationKeyword(fin, productDestination)) return ''
    return fin
  }
  try {
    const kw = finalizeScheduleImageKeyword(fin)
    if (!kw || isHanatourDomesticHubToken(kw)) return ''
    if (isHanatourCrossContinentHallucinationKeyword(kw, productDestination)) return ''
    if (isHanatourForeignAirportImageKeyword(kw)) return ''
    if (isAirlineCarrierImageKeyword(kw)) return ''
    return kw
  } catch {
    return ''
  }
}

function inferHanatourKeywordFromDayContent(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  const inferred = inferEnglishPlaceKeywordFromDayContent(row, productDestination)
  if (!inferred) return ''
  return tryAcceptHanatourLlmImageKeyword(inferred, productDestination)
}

function segmentToAcceptedHanatourKeyword(
  seg: string,
  productDestination: string | null | undefined,
): string {
  const latin = extractLatinEnglishFromRouteSegment(seg)
  if (latin) {
    const accepted = tryAcceptHanatourLlmImageKeyword(latin, productDestination)
    if (accepted) return accepted
  }
  const fromKo = englishFromKoreanRouteSegment(seg)
  if (fromKo) {
    const accepted = tryAcceptHanatourLlmImageKeyword(fromKo, productDestination)
    if (accepted) return accepted
  }
  return ''
}

/** routeText 해외 구간 — 영문·한글(매핑) 모두, pickLast면 이동 순서상 뒤쪽 우선 */
function pickForeignPlaceFromRouteText(
  routeText: string | null | undefined,
  pickLast: boolean,
  productDestination: string | null | undefined,
): string {
  const segs = routeTextSegments(routeText).filter((s) => !isHanatourDomesticHubToken(s))
  if (!segs.length) return ''
  const nonAirport = segs.filter((s) => !isHanatourForeignAirportRouteSegment(s))
  const useSegs = nonAirport.length > 0 ? nonAirport : segs
  const ordered = pickLast ? [...useSegs].reverse() : useSegs
  for (const seg of ordered) {
    const kw = segmentToAcceptedHanatourKeyword(seg, productDestination)
    if (kw) return kw
  }
  return ''
}

function collectTripForeignPlaceKeywordsInDayOrder(
  rows: HanatourScheduleImageKeywordRow[],
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const sorted = [...rows].filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  for (const row of sorted) {
    for (const seg of routeTextSegments(row.routeText)) {
      if (isHanatourDomesticHubToken(seg)) continue
      const kw = segmentToAcceptedHanatourKeyword(seg, productDestination)
      if (!kw) continue
      const nk = normKey(kw)
      if (seen.has(nk)) continue
      seen.add(nk)
      out.push(kw)
    }
  }
  return out
}

function productDestinationToAcceptedKeyword(
  productDestination: string | null | undefined,
): string {
  const raw = String(productDestination ?? '').trim()
  if (!raw) return ''
  const en = mapDestination(raw)
  if (!en || (en === raw && /[\uAC00-\uD7AF]/.test(raw))) return ''
  return tryAcceptHanatourLlmImageKeyword(en, productDestination)
}

/**
 * 1일차: 첫 해외 도시 키워드 일차.
 * 마지막 일차: 귀국·공항 동선이 본문에 있을 때만(순수 관광 마지막 일은 제외).
 */
function isHanatourDestinationCityDay(day: number, maxDay: number, haystack: string): boolean {
  if (maxDay < 1) return false
  if (day === 1) return true
  if (day !== maxDay || maxDay < 2) return false
  const j = haystack.slice(0, 12_000)
  if (/(?:귀국|인천|ICN|김포|GMP)(?:\s*국제)?\s*공항?\s*도착/u.test(j)) return false
  const hasHub = /(?:인천|ICN|김포|GMP|부산|PUS|대구|TAE|청주|CJJ|김해)(?:\s*국제)?\s*공항?/u.test(j)
  const hasFlightCue = /(?:출발|도착|귀국|탑승|도착)/u.test(j)
  return hasHub && hasFlightCue
}

function resolveHanatourDestinationCityDayKeyword(
  row: HanatourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: HanatourScheduleImageKeywordRow[],
): string {
  const tripPlaces = collectTripForeignPlaceKeywordsInDayOrder(allRows, productDestination)
  const pickLast = day === 1 || (day === maxDay && maxDay >= 2 && day !== 1)
  const fromRoute = pickForeignPlaceFromRouteText(row.routeText, pickLast, productDestination)

  if (day === 1) {
    if (fromRoute) return fromRoute
    if (tripPlaces[0]) return tripPlaces[0]!
    const fromProduct = productDestinationToAcceptedKeyword(productDestination)
    if (fromProduct) return fromProduct
    return inferHanatourKeywordFromDayContent(row, productDestination)
  }

  const fromProduct = productDestinationToAcceptedKeyword(productDestination)
  if (fromProduct) return fromProduct
  if (tripPlaces.length) return tripPlaces[tripPlaces.length - 1]!
  if (fromRoute) return fromRoute
  return inferHanatourKeywordFromDayContent(row, productDestination)
}

function resolveHanatourMovementDayKeyword(
  row: HanatourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: HanatourScheduleImageKeywordRow[],
): string {
  const pickLast = day === maxDay && maxDay >= 2
  const fromRoute = pickForeignPlaceFromRouteText(row.routeText, pickLast, productDestination)
  if (fromRoute) return fromRoute

  const tripPlaces = collectTripForeignPlaceKeywordsInDayOrder(allRows, productDestination)
  if (day === 1 && tripPlaces[0]) return tripPlaces[0]!
  if (day === maxDay && tripPlaces.length) return tripPlaces[tripPlaces.length - 1]!

  const fromProduct = productDestinationToAcceptedKeyword(productDestination)
  if (fromProduct) return fromProduct

  return inferHanatourKeywordFromDayContent(row, productDestination)
}

function countPriorHanatourFreeLeisureDays(
  allRows: HanatourScheduleImageKeywordRow[],
  beforeDay: number,
): number {
  let n = 0
  for (const row of allRows) {
    const day = Number(row.day)
    if (day <= 0 || day >= beforeDay) continue
    if (isHanatourScheduleFreeLeisureDay(buildHanatourDayHaystack(row))) n++
  }
  return n
}

/** 귀국일 — 직전 관광 일차에 이미 확정된 imageKeyword */
function findLastResolvedHanatourTourismKeywordBeforeDay<
  T extends HanatourScheduleImageKeywordRow,
>(mapped: T[], beforeDay: number, maxDay: number): string {
  const sorted = mapped
    .filter((r) => Number(r.day) > 0 && Number(r.day) < beforeDay)
    .sort((a, b) => Number(b.day) - Number(a.day))
  for (const row of sorted) {
    const day = Number(row.day)
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind === 'return_home') continue
    if (isHanatourScheduleFreeLeisureDay(haystack)) continue
    const kw = String(row.imageKeyword ?? '').trim()
    if (kw) return kw
  }
  return ''
}

function resolveHanatourPrimaryKeyword(
  row: HanatourScheduleImageKeywordRow,
  dayKind: HanatourScheduleCardDayKind,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: HanatourScheduleImageKeywordRow[],
  opts?: HanatourScheduleImageKeywordOpts,
  usedPrimary?: Set<string>,
): string {
  const haystack = buildHanatourDayHaystack(row)
  const acceptLlm = (raw: string | null | undefined) =>
    tryAcceptHanatourLlmImageKeyword(raw, productDestination)
  const accepted = acceptLlm(row.imageKeyword)
  const finish = (kw: string) => commitHanatourPrimaryKeyword(kw, dayKind, usedPrimary)

  if (dayKind === 'return_home') {
    const fromSchedule = pickFirstUnusedHanatourScheduleLandmark(row, productDestination, usedPrimary)
    if (fromSchedule) return fromSchedule
    return ''
  }

  if (isHanatourScheduleFreeLeisureDay(haystack)) {
    const example = pickHanatourFreeDayExampleImageKeyword({
      optionalTourNames: opts?.optionalTourNames ?? [],
      freeDayIndex: countPriorHanatourFreeLeisureDays(allRows, day),
      toKeyword: (name) => {
        const mapped = extractEnglishPoiFromLabel(name) || mapKoreanPoiSegment(name)
        return tryAcceptHanatourLlmImageKeyword(mapped || name, productDestination)
      },
    })
    if (example) return finish(example)
    return ''
  }

  // REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]: 일정 본문 명소 등장 순 — LLM·route 도시명보다 우선
  const fromScheduleOrdered = pickFirstUnusedHanatourScheduleLandmark(row, productDestination, usedPrimary)
  if (fromScheduleOrdered) return fromScheduleOrdered

  if (
    day === 1 &&
    (isHanatourForeignAirportImageKeyword(accepted) ||
      isHanatourForeignAirportImageKeyword(String(row.imageKeyword ?? '')) ||
      isHanatourBareCityKeyword(accepted))
  ) {
    const fromRoute = pickForeignPlaceFromRouteText(row.routeText, true, productDestination)
    if (fromRoute && !isHanatourForeignAirportImageKeyword(fromRoute) && !isHanatourBareCityKeyword(fromRoute)) {
      return finish(fromRoute)
    }
    for (const { re, en } of SCHEDULE_SPOT_KO_REGEX_RULES) {
      if (!re.test(haystack)) continue
      const kw = tryAcceptHanatourMappedPoiKeyword(en, productDestination)
      if (kw && !isHanatourForeignAirportImageKeyword(kw)) return finish(kw)
    }
    const resolved = resolveHanatourDestinationCityDayKeyword(
      row,
      day,
      maxDay,
      productDestination,
      allRows,
    )
    if (resolved && !isHanatourForeignAirportImageKeyword(resolved)) return finish(resolved)
  }

  if (dayKind === 'tourism' && accepted && isKnownDestinationCityEnglishKeyword(accepted)) {
    const fromPoi = preferPoiOverBareCityLlm(row, accepted, productDestination)
    if (fromPoi !== accepted && !isHanatourBareCityKeyword(fromPoi)) return finish(fromPoi)
  }

  const acceptedIsLandmarkEligible =
    !!accepted &&
    (dayKind === 'tourism'
      ? isScheduleImageKeywordLandmarkEligible(accepted) && !isHanatourBareCityKeyword(accepted)
      : !isNonLandmarkFoodOrDiningImageKeyword(accepted) &&
        !isNonLandmarkSpaShoppingLoungeImageKeyword(accepted) &&
        !isWeakOpaqueImageKeyword(accepted) &&
        (isKnownDestinationCityEnglishKeyword(accepted) || isScheduleImageKeywordLandmarkEligible(accepted)))
  if (acceptedIsLandmarkEligible) {
    const isHubOrFlight =
      isHanatourDestinationCityDay(day, maxDay, haystack) ||
      dayKind === 'movement'
    if (!isHubOrFlight && dayKind === 'tourism' && isKnownDestinationCityEnglishKeyword(accepted)) {
      const fromPoi = preferPoiOverBareCityLlm(row, accepted, productDestination)
      if (fromPoi !== accepted && !isHanatourBareCityKeyword(fromPoi)) return finish(fromPoi)
    }
    if (dayKind === 'tourism') {
      const landmarks = collectHanatourOrderedScheduleLandmarks(row, productDestination)
      const resolved = resolveTourismKeywordPreferDistinctPerDay({
        row,
        acceptedLlm: accepted,
        allRows,
        acceptLlm,
        daySpecificCandidates: landmarks,
      })
      if (resolved && !isHanatourBareCityKeyword(resolved)) {
        const nk = normKey(resolved)
        if (!usedPrimary?.has(nk)) return finish(resolved)
      }
    }
    if (dayKind !== 'tourism' || !isHanatourBareCityKeyword(accepted)) {
      if (!(dayKind === 'movement' && isHanatourBareCityKeyword(accepted))) {
        return finish(accepted)
      }
    }
  }

  if (dayKind === 'movement') {
    return finish(resolveHanatourMovementDayKeyword(row, day, maxDay, productDestination, allRows))
  }

  if (isHanatourDestinationCityDay(day, maxDay, haystack)) {
    return finish(resolveHanatourDestinationCityDayKeyword(row, day, maxDay, productDestination, allRows))
  }

  for (const kw of collectHanatourOrderedScheduleLandmarks(row, productDestination)) {
    const nk = normKey(kw)
    if (usedPrimary?.has(nk)) continue
    return finish(kw)
  }

  const fromRouteLast = pickForeignPlaceFromRouteText(row.routeText, true, productDestination)
  if (fromRouteLast && !isHanatourBareCityKeyword(fromRouteLast)) return finish(fromRouteLast)

  const fromRoute = pickForeignPlaceFromRouteText(row.routeText, false, productDestination)
  if (fromRoute && !isHanatourBareCityKeyword(fromRoute)) return finish(fromRoute)

  const inferred = inferHanatourKeywordFromDayContent(row, productDestination)
  if (inferred && !isHanatourBareCityKeyword(inferred)) return finish(inferred)

  if (dayKind === 'tourism') {
    for (const kw of [...collectHanatourTripLandmarkCandidates(allRows, productDestination)].reverse()) {
      const nk = normKey(kw)
      if (!nk || usedPrimary?.has(nk) || isHanatourBareCityKeyword(kw)) continue
      return finish(kw)
    }
  }

  return ''
}

function resolveHanatourSecondaryKeyword(
  row: HanatourScheduleImageKeywordRow,
  primary: string,
  dayKind: HanatourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (!primary) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const fromLlm = tryAcceptHanatourLlmImageKeyword(row.imageKeyword2, productDestination)
  if (
    fromLlm &&
    normKey(fromLlm) !== normKey(primary) &&
    !isHanatourBareCityKeyword(fromLlm)
  ) {
    return fromLlm
  }

  const fromRoute = pickDistinctPlaceFromRouteText(row.routeText, primary, productDestination)
  if (
    fromRoute &&
    !isHanatourBareCityKeyword(fromRoute) &&
    normKey(fromRoute) !== normKey(primary)
  ) {
    return fromRoute
  }

  const bodyHaystack = buildHanatourDayHaystack(row)
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(bodyHaystack)) {
    const kw = tryAcceptHanatourLlmImageKeyword(en, productDestination)
    if (kw && normKey(kw) !== normKey(primary) && !isHanatourBareCityKeyword(kw)) return kw
  }

  const rawLandmarks = collectHanatourOrderedScheduleLandmarks(row, productDestination)
  const fromOrdered = pickDistinctSecondScheduleImageKeyword(primary, rawLandmarks)
  if (fromOrdered) {
    const accepted = tryAcceptHanatourLlmImageKeyword(fromOrdered, productDestination)
    if (
      accepted &&
      normKey(accepted) !== normKey(primary) &&
      !isHanatourBareCityKeyword(accepted)
    ) {
      return accepted
    }
    if (normKey(fromOrdered) !== normKey(primary) && !isHanatourBareCityKeyword(fromOrdered)) {
      return fromOrdered
    }
  }

  for (const kw of rawLandmarks) {
    if (normKey(kw) === normKey(primary)) continue
    if (!isHanatourBareCityKeyword(kw)) return kw
  }

  return null
}

function collectHanatourDayPrimaryCandidates(
  row: HanatourScheduleImageKeywordRow,
  dayKind: HanatourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const kw = String(raw ?? '').trim()
    if (!kw) return
    if (out.some((x) => normKey(x) === normKey(kw))) return
    out.push(kw)
  }
  if (dayKind === 'tourism') {
    for (const kw of collectHanatourOrderedScheduleLandmarks(row, productDestination)) push(kw)
  }
  push(row.imageKeyword)
  return out
}

/** LLM·도시명이 여러 관광 일차에 반복될 때 route·본문 명소로 일차별 분산 */
function dedupeHanatourTourismPrimaryKeywordsAcrossDays<T extends HanatourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const used = new Set<string>()
  const tripLandmarks: string[] = []

  const sorted = rows
    .filter((r) => Number(r.day) > 0)
    .sort((a, b) => Number(a.day) - Number(b.day))

  for (const row of sorted) {
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(Number(row.day), maxDay, haystack)
    if (dayKind !== 'tourism') continue
    for (const kw of collectHanatourDayPrimaryCandidates(row, dayKind, productDestination)) {
      if (!tripLandmarks.some((x) => normKey(x) === normKey(kw))) tripLandmarks.push(kw)
    }
  }

  const pickUnused = (cands: string[]): string | null => {
    for (const kw of cands) {
      const nk = normKey(kw)
      if (!nk || used.has(nk)) continue
      used.add(nk)
      return kw
    }
    return null
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row

    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'tourism') return row

    const primary = String(row.imageKeyword ?? '').trim()
    if (!primary) return row

    const nk = normKey(primary)
    if (!used.has(nk)) {
      used.add(nk)
      return row
    }

    const fromDay = pickUnused(collectHanatourDayPrimaryCandidates(row, dayKind, productDestination))
    if (fromDay) return { ...row, imageKeyword: fromDay }

    const fromTrip = pickUnused(tripLandmarks)
    if (fromTrip) return { ...row, imageKeyword: fromTrip }

    return row
  })
}

function hanatourRouteSegmentToImageKeyword(
  seg: string,
  productDestination: string | null | undefined,
): string {
  if (isRegisterScheduleRoutePlaceNoise(seg) || isNonLandmarkRouteTextSegment(seg)) return ''
  const fromLandmark = hanatourLandmarkFromRouteSegment(seg, seg, productDestination)
  if (fromLandmark) return fromLandmark
  return segmentToAcceptedHanatourKeyword(seg, productDestination)
}

function collectHanatourRouteOrderedSegmentKeywords(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    if (isHanatourDomesticHubToken(seg)) continue
    if (isRegisterScheduleRoutePlaceNoise(seg) || isNonLandmarkRouteTextSegment(seg)) continue
    const en = hanatourRouteSegmentToImageKeyword(seg, productDestination)
    if (!en || isHanatourDomesticHubToken(en)) continue
    if (out.some((x) => keysEqual(x, en))) continue
    out.push(en)
  }
  return out
}

/** routeText a→g 순서 우선, 부족 시 본문 명소·LLM — allocate 슬롯 채움 SSOT */
function collectHanatourDayOrderedKeywordCandidates(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const kw = String(raw ?? '').trim()
    if (!kw || isHanatourDomesticHubToken(kw)) return
    if (out.some((x) => keysEqual(x, kw))) return
    out.push(kw)
  }
  for (const kw of collectHanatourRouteOrderedSegmentKeywords(row.routeText, productDestination)) {
    push(kw)
  }
  for (const kw of collectHanatourOrderedScheduleLandmarks(row, productDestination)) {
    push(kw)
  }
  push(tryAcceptHanatourLlmImageKeyword(row.imageKeyword, productDestination))
  push(tryAcceptHanatourLlmImageKeyword(row.imageKeyword2, productDestination))
  return out
}

function pickHanatourReturnKeywordFromPrevDay(
  prevAlloc: { primary: string; secondary: string | null } | undefined,
  prevRouteOrdered: readonly string[],
  prevFullCandidates: readonly string[],
  productDestination: string | null | undefined,
  used?: ReadonlySet<string>,
): string {
  const rejectReturnKw = (kw: string): boolean =>
    !kw ||
    isHanatourForeignAirportImageKeyword(kw) ||
    isScheduleAirportLikeImageKeyword(kw) ||
    isHanatourBareCityKeyword(kw)

  const pickFrom = (list: readonly string[]): string => {
    for (let i = list.length - 1; i >= 0; i--) {
      const kw = list[i]!
      if (prevAlloc && keysEqual(kw, prevAlloc.primary)) continue
      if (prevAlloc?.secondary && keysEqual(kw, prevAlloc.secondary)) continue
      if (rejectReturnKw(kw)) continue
      const nk = normKey(kw)
      if (used && nk && used.has(nk)) continue
      return kw
    }
    return ''
  }
  return pickFrom(prevRouteOrdered) || pickFrom(prevFullCandidates)
}

function pickHanatourReturnKeywordFromOwnRoute(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
  used: ReadonlySet<string>,
): string {
  const ownRoute = collectHanatourRouteOrderedSegmentKeywords(row.routeText, productDestination)
  const tryKw = (kw: string): string => {
    if (
      !kw ||
      isHanatourForeignAirportImageKeyword(kw) ||
      isScheduleAirportLikeImageKeyword(kw) ||
      isHanatourBareCityKeyword(kw)
    ) {
      return ''
    }
    const nk = normKey(kw)
    if (nk && used.has(nk)) return ''
    return kw
  }
  for (let i = ownRoute.length - 1; i >= 0; i--) {
    const picked = tryKw(ownRoute[i]!)
    if (picked) return picked
  }
  for (const kw of ownRoute) {
    const picked = tryKw(kw)
    if (picked) return picked
  }
  return ''
}

function hanatourKeywordKeysOverlap(a: string, b: string): boolean {
  const ak = normKey(a)
  const bk = normKey(b)
  if (!ak || !bk) return false
  if (ak === bk) return true
  return ak.includes(bk) || bk.includes(ak)
}

function pickFirstUnusedHanatourRouteKeyword(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
): string {
  for (const kw of ordered) {
    if (!kw) continue
    const accepted = acceptScheduleTourismImageKeywordOrEmpty(kw)
    if (!accepted) continue
    if (excludePrimary && hanatourKeywordKeysOverlap(accepted, excludePrimary)) continue
    const nk = normKey(accepted)
    if (!nk || used.has(nk)) continue
    return accepted
  }
  return ''
}

/** routeText 순서 유지 — 랜드마크 우선, 도시명은 같은 일차 후보가 없을 때만 */
function pickFirstUnusedHanatourRouteKeywordPreferLandmark(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
): string {
  const landmarks = ordered.filter((kw) => kw && !isHanatourBareCityKeyword(kw))
  return (
    pickFirstUnusedHanatourRouteKeyword(landmarks, used, excludePrimary) ||
    pickFirstUnusedHanatourRouteKeyword(ordered, used, excludePrimary)
  )
}

/** kw2 — primary 이후 routeText 순서의 두 번째 랜드마크(도시·공항 제외) */
function pickFirstUnusedHanatourRouteSecondLandmark(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  primary: string,
): string {
  let passedPrimary = false
  for (const kw of ordered) {
    if (!kw) continue
    const accepted = acceptScheduleTourismImageKeywordOrEmpty(kw)
    if (!accepted) continue
    if (!passedPrimary) {
      if (hanatourKeywordKeysOverlap(accepted, primary)) passedPrimary = true
      continue
    }
    if (hanatourKeywordKeysOverlap(accepted, primary)) continue
    if (isHanatourBareCityKeyword(accepted)) continue
    if (isScheduleAirportLikeImageKeyword(accepted)) continue
    const nk = normKey(accepted)
    if (!nk || used.has(nk)) continue
    return accepted
  }
  return ''
}

function pickHanatourDepartureRepresentativeKeyword(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  for (const seg of routeTextSegments(routeText)) {
    if (isHanatourDomesticHubToken(seg)) continue
    if (isRegisterScheduleRoutePlaceNoise(seg) || isNonLandmarkRouteTextSegment(seg)) continue
    const en = hanatourRouteSegmentToImageKeyword(seg, productDestination)
    if (en && !isHanatourDomesticHubToken(en)) return en
  }
  return ''
}

/** 1일차 — 항공·공항-only·기내박만 빈 키워드 허용. route에 랜드마크 있으면 false */
// REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: isHanatourDepartureMovementOnlyRow — manifest
function isHanatourDepartureMovementOnlyRow(
  row: HanatourScheduleImageKeywordRow,
  routeOrdered: readonly string[],
): boolean {
  if (isScheduleInFlightOvernightRow(row)) return true
  if (isScheduleAirportOnlyRouteText(row.routeText, isHanatourDomesticHubToken)) return true
  if (routeOrdered.some((kw) => String(kw ?? '').trim())) return false
  const segs = routeTextSegments(row.routeText).filter(
    (s) =>
      !isRegisterScheduleRoutePlaceNoise(s) &&
      !isHanatourDomesticHubToken(s) &&
      !isNonLandmarkRouteTextSegment(s),
  )
  if (!segs.length) return true
  return segs.every(
    (s) =>
      isRegisterScheduleAirlineRouteSegment(s) ||
      isScheduleAirportRouteSegmentText(s) ||
      isHanatourForeignAirportRouteSegment(s),
  )
}

type HanatourKeywordSlotKind = 'departure' | 'middle' | 'return'

function resolveHanatourKeywordSlotKind(
  day: number,
  maxDay: number,
  scheduleRowCount: number,
): HanatourKeywordSlotKind {
  return resolveScheduleKeywordSlotKind(day, maxDay, scheduleRowCount)
}

function findHanatourRowByDay<T extends HanatourScheduleImageKeywordRow>(
  sorted: readonly T[],
  targetDay: number,
): T | undefined {
  return sorted.find((r) => Number(r.day) === targetDay)
}

function findPrevHanatourScheduledRow<T extends HanatourScheduleImageKeywordRow>(
  sorted: readonly T[],
  day: number,
): T | undefined {
  let prev: T | undefined
  for (const row of sorted) {
    const d = Number(row.day)
    if (d >= day) break
    prev = row
  }
  return prev
}

function hanatourAdjacentLandmarkCandidates(
  row: HanatourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  return collectHanatourDayOrderedKeywordCandidates(row, productDestination)
}

function pickHanatourAdjacentUnusedKeyword(
  anchorDay: number,
  maxDay: number,
  sorted: readonly HanatourScheduleImageKeywordRow[],
  used: ReadonlySet<string>,
  byDay: ReadonlyMap<number, ScheduleAdjacentDayAlloc>,
  productDestination: string | null | undefined,
  scan: 'forward' | 'backward' | 'both',
  excludePrimary?: string,
  allowTripWideReuse = false,
  rejectKeyword?: (kw: string) => boolean,
  ignoreAdjacentDaySlots = false,
): string {
  return pickUnusedScheduleImageKeywordFromAdjacentDays({
    anchorDay,
    maxDay,
    sorted,
    getDay: (r) => Number(r.day),
    used,
    normKey,
    collectLandmarkCandidates: (r) => hanatourAdjacentLandmarkCandidates(r, productDestination),
    byDayAlloc: byDay,
    scan,
    excludePrimary,
    allowTripWideReuse,
    ignoreAdjacentDaySlots,
    rejectKeyword:
      rejectKeyword ??
      ((kw) =>
        isHanatourForeignAirportImageKeyword(kw) ||
        isScheduleAirportLikeImageKeyword(kw)),
  })
}

/** 일정요약 routeText 순서 + 일차 슬롯 규칙 SSOT (이 상품 1건만, trip-wide used) */
function allocateHanatourImageKeywordsByScheduleRules<T extends HanatourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const used = new Set<string>()
  const byDay = new Map<number, { primary: string; secondary: string | null }>()

  for (const row of sorted) {
    const day = Number(row.day)
    const slotKind = resolveHanatourKeywordSlotKind(day, maxDay, sorted.length)

    if (slotKind === 'departure') {
      const routeOrdered = collectHanatourRouteOrderedSegmentKeywords(
        row.routeText,
        productDestination,
      )
      const movementOnly = isHanatourDepartureMovementOnlyRow(row, routeOrdered)
      let primary = ''
      let secondary = ''
      if (!movementOnly) {
        primary = pickFirstUnusedHanatourRouteKeywordPreferLandmark(routeOrdered, used) || ''
        if (primary && isScheduleAirportLikeImageKeyword(primary)) primary = ''
        if (primary) used.add(normKey(primary))
        if (primary) {
          secondary = pickFirstUnusedHanatourRouteSecondLandmark(routeOrdered, used, primary) || ''
          if (secondary) used.add(normKey(secondary))
        }
      }
      byDay.set(day, { primary, secondary: secondary || null })
      continue
    }

    if (slotKind === 'return') {
      const domesticReturnOnly = isScheduleAirportOnlyRouteText(row.routeText, isHanatourDomesticHubToken)
      let primary = pickHanatourReturnKeywordFromOwnRoute(row, productDestination, used)
      if (!primary && String(row.routeText ?? '').trim()) {
        primary = pickHanatourDepartureRepresentativeKeyword(row.routeText, productDestination) || ''
        if (primary && (isHanatourForeignAirportImageKeyword(primary) || isScheduleAirportLikeImageKeyword(primary))) {
          primary = ''
        }
        if (primary && isHanatourBareCityKeyword(primary)) primary = ''
        const nk = normKey(primary)
        if (primary && nk && used.has(nk)) primary = ''
      }
      if (!primary && !domesticReturnOnly) {
        let walkDay = maxDay - 1
        while (walkDay > 0 && !primary) {
          const prevRow =
            findHanatourRowByDay(sorted, walkDay) ?? findPrevHanatourScheduledRow(sorted, walkDay + 1)
          if (!prevRow) break
          const prevAlloc = byDay.get(Number(prevRow.day))
          const prevRouteOrdered = collectHanatourRouteOrderedSegmentKeywords(
            prevRow.routeText,
            productDestination,
          )
          const prevFull = collectHanatourDayOrderedKeywordCandidates(prevRow, productDestination)
          primary = pickHanatourReturnKeywordFromPrevDay(
            prevAlloc,
            prevRouteOrdered,
            prevFull,
            productDestination,
            used,
          )
          walkDay = Number(prevRow.day) - 1
        }
      }
      if (!primary && !domesticReturnOnly) {
        primary =
          pickHanatourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'backward',
          ) || ''
      }
      if (primary) used.add(normKey(primary))
      byDay.set(day, { primary, secondary: null })
      continue
    }

    const movementOnly =
      isScheduleInFlightOvernightRow(row) ||
      isScheduleAirportOnlyRouteText(row.routeText, isHanatourDomesticHubToken)

    const routeOrdered = collectHanatourRouteOrderedSegmentKeywords(row.routeText, productDestination)
    const ordered = collectHanatourDayOrderedKeywordCandidates(row, productDestination)
    let primary = movementOnly
      ? ''
      : pickFirstUnusedHanatourRouteKeywordPreferLandmark(routeOrdered, used)
    if (!primary) {
      primary = pickFirstUnusedHanatourRouteKeywordPreferLandmark(ordered, used)
    }
    if (movementOnly) {
      if (!primary || isScheduleAirportLikeImageKeyword(primary)) {
        primary =
          pickHanatourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'backward',
          ) || primary
      }
    } else if (!primary && movementOnly) {
      primary =
        pickHanatourAdjacentUnusedKeyword(
          day,
          maxDay,
          sorted,
          used,
          byDay,
          productDestination,
          'backward',
        ) || ''
    }
    if (primary) used.add(normKey(primary))
    let secondary = primary
      ? pickFirstUnusedHanatourRouteKeyword(routeOrdered, used, primary) || ''
      : ''
    if (!secondary && primary) {
      const fromLlm2 = tryAcceptHanatourLlmImageKeyword(row.imageKeyword2, productDestination)
      if (
        fromLlm2 &&
        !hanatourKeywordKeysOverlap(fromLlm2, primary) &&
        !used.has(normKey(fromLlm2))
      ) {
        secondary = fromLlm2
      }
    }
    const hasSecondRouteKeyword =
      !!primary &&
      routeOrdered.some((kw) => kw && !hanatourKeywordKeysOverlap(kw, primary))
    if (!secondary && hasSecondRouteKeyword) {
      secondary =
        pickDistinctSecondScheduleImageKeyword(primary, ordered) ||
        resolveHanatourSecondaryKeyword(row, primary, 'tourism', productDestination) ||
        ''
      if (secondary && used.has(normKey(secondary))) secondary = ''
    }
    if (
      primary &&
      !secondary &&
      shouldFillScheduleMiddleKeyword2Gap(row, routeOrdered, primary, hanatourKeywordKeysOverlap, {
        movementOnly,
      })
    ) {
      secondary = fillScheduleMiddleImageKeyword2Gap({
        primary,
        routeOrdered,
        extraOrdered: ordered,
        overlaps: hanatourKeywordKeysOverlap,
        rejectKeyword: (kw) =>
          isHanatourForeignAirportImageKeyword(kw) ||
          isScheduleAirportLikeImageKeyword(kw) ||
          isHanatourCrossContinentHallucinationKeyword(kw, productDestination),
        pickAdjacent: (allowTripWideReuse, ignoreAdjacentDaySlots) =>
          pickHanatourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'both',
            primary,
            allowTripWideReuse,
            undefined,
            ignoreAdjacentDaySlots,
          ),
      })
    }
    if (secondary) used.add(normKey(secondary))
    if (secondary && hanatourKeywordKeysOverlap(secondary, primary)) {
      secondary = ''
    }
    byDay.set(day, { primary, secondary: secondary || null })
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }
    const alloc = byDay.get(day)
    if (!alloc) {
      return { ...row, imageKeyword: '', imageKeyword2: null }
    }
    return {
      ...row,
      imageKeyword: alloc.primary,
      imageKeyword2: alloc.secondary,
    }
  })
}

export function applyHanatourScheduleImageKeywordsToRows<
  T extends HanatourScheduleImageKeywordRow,
>(rows: T[], opts?: HanatourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = opts?.productDestination ?? null
  const inputByDay = new Map(sorted.map((r) => [Number(r.day), r] as const))
  const prevScheduleSectionByDay = activeHanatourScheduleSectionByDay
  activeHanatourScheduleSectionByDay = opts?.scheduleSectionByDay ?? null
  let out: T[]
  try {
    out = allocateHanatourImageKeywordsByScheduleRules(rows, maxDay, productDestination)
  } finally {
    activeHanatourScheduleSectionByDay = prevScheduleSectionByDay
  }
  activeHanatourScheduleSectionByDay = opts?.scheduleSectionByDay ?? null

  const used = new Set<string>()
  for (const row of out) {
    const kw = String(row.imageKeyword ?? '').trim()
    if (kw) used.add(normKey(kw))
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (kw2) used.add(normKey(kw2))
  }

  try {
    return out.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row

    const inputRow = inputByDay.get(day)
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    const slotKind = resolveHanatourKeywordSlotKind(day, maxDay, sorted.length)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = row.imageKeyword2

    const inputPrimary = tryAcceptHanatourLlmImageKeyword(inputRow?.imageKeyword, productDestination)
    const hasScheduleSectionForDay = Boolean(opts?.scheduleSectionByDay?.get(day)?.trim())
    if (hasScheduleSectionForDay && slotKind !== 'departure') {
      const fromSection = resolveHanatourPrimaryKeyword(
        row,
        dayKind,
        day,
        maxDay,
        productDestination,
        out,
        opts,
        used,
      )
      if (fromSection) {
        primary = fromSection
        if (slotKind === 'middle') secondary = null
      }
    } else if (
      sorted.length === 1 &&
      inputPrimary &&
      !isHanatourForeignAirportImageKeyword(inputPrimary) &&
      !isScheduleAirportLikeImageKeyword(inputPrimary)
    ) {
      primary = inputPrimary
      secondary = null
    }

    const inputSecondary = tryAcceptHanatourLlmImageKeyword(inputRow?.imageKeyword2, productDestination)
    if (inputSecondary && primary && !hanatourKeywordKeysOverlap(inputSecondary, primary)) {
      secondary = inputSecondary
    }

    if ((slotKind === 'middle' || slotKind === 'departure') && primary && !String(secondary ?? '').trim()) {
      const routeOrdered = collectHanatourRouteOrderedSegmentKeywords(
        row.routeText,
        productDestination,
      )
      const ordered = collectHanatourDayOrderedKeywordCandidates(row, productDestination)
      const movementOnly =
        slotKind === 'departure'
          ? isHanatourDepartureMovementOnlyRow(row, routeOrdered)
          : isScheduleInFlightOvernightRow(row) ||
            isScheduleAirportOnlyRouteText(row.routeText, isHanatourDomesticHubToken)

      if (slotKind === 'departure') {
        secondary =
          pickFirstUnusedHanatourRouteSecondLandmark(routeOrdered, used, primary) || ''
      } else {
      secondary =
        resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination) ||
        pickDistinctScheduleRouteSecondKeyword(
          primary,
          routeOrdered,
          ordered,
          hanatourKeywordKeysOverlap,
          (kw) =>
            isHanatourForeignAirportImageKeyword(kw) ||
            isScheduleAirportLikeImageKeyword(kw) ||
            isHanatourCrossContinentHallucinationKeyword(kw, productDestination),
        ) ||
        ''
      if (
        !secondary &&
        shouldFillScheduleMiddleKeyword2Gap(row, routeOrdered, primary, hanatourKeywordKeysOverlap, {
          movementOnly,
        })
      ) {
        const byDay = new Map<number, ScheduleAdjacentDayAlloc>()
        for (const r of out) {
          const d = Number(r.day)
          if (d <= 0) continue
          byDay.set(d, {
            primary: String(r.imageKeyword ?? '').trim(),
            secondary: r.imageKeyword2 ?? null,
          })
        }
        secondary = fillScheduleMiddleImageKeyword2Gap({
          primary,
          routeOrdered,
          extraOrdered: ordered,
          overlaps: hanatourKeywordKeysOverlap,
          rejectKeyword: (kw) =>
            isHanatourForeignAirportImageKeyword(kw) ||
            isScheduleAirportLikeImageKeyword(kw) ||
            isHanatourCrossContinentHallucinationKeyword(kw, productDestination),
          pickAdjacent: (allowTripWideReuse, ignoreAdjacentDaySlots) =>
            pickUnusedScheduleImageKeywordFromAdjacentDays({
              anchorDay: day,
              maxDay,
              sorted: out,
              getDay: (r) => Number(r.day),
              used,
              normKey,
              collectLandmarkCandidates: (r) =>
                hanatourAdjacentLandmarkCandidates(r, productDestination),
              byDayAlloc: byDay,
              scan: 'both',
              rejectKeyword: (kw) =>
                isHanatourForeignAirportImageKeyword(kw) ||
                isScheduleAirportLikeImageKeyword(kw) ||
                isHanatourCrossContinentHallucinationKeyword(kw, productDestination),
              excludePrimary: primary,
              allowTripWideReuse,
              ignoreAdjacentDaySlots,
            }),
        })
        if (secondary) used.add(normKey(secondary))
      }
      }
    }

    if (secondary && hanatourKeywordKeysOverlap(String(secondary), primary)) {
      secondary = null
    }

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2:
        slotKind === 'return'
          ? null
          : String(secondary ?? '').trim() || null,
    }
    })
  } finally {
    activeHanatourScheduleSectionByDay = prevScheduleSectionByDay
  }
}
