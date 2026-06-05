/**
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]: 자유여행 imageKeyword — 식당·카페 금지, 랜드마크만 — manifest
 */
import {
  classifyHanatourScheduleCardDayKind,
  type HanatourScheduleCardDayKind,
} from '@/lib/parse-and-register-hanatour-schedule'
import {
  acceptLlmScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  resolveTourismKeywordPreferDistinctPerDay,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  findAllMappedKoreanPoisInText,
  findMappedKoreanPoisInTextByMentionOrder,
  isKnownDestinationCityEnglishKeyword,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
} from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isLikelyTourismLandmarkKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'

export type HanatourScheduleImageKeywordOpts = {
  productDestination?: string | null
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

function buildHanatourDayHaystack(row: HanatourScheduleImageKeywordRow): string {
  return [row.title, row.description, row.routeText].filter(Boolean).join('\n').replace(/\r/g, '')
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
  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    try {
      return finalizeScheduleImageKeyword(fromPoi)
    } catch {
      /* continue */
    }
  }
  const fromDest = mapDestination(t)
  if (fromDest && fromDest !== t) {
    try {
      return finalizeScheduleImageKeyword(fromDest)
    } catch {
      /* continue */
    }
  }
  return ''
}

/** routeText 2번째 세그먼트 — 영문·한글(매핑) */
function resolveRouteTextSecondPlace(routeText: string | null | undefined): string {
  const segs = routeTextSegments(routeText)
  if (segs.length < 2) return ''
  return extractLatinEnglishFromRouteSegment(segs[1]!) || englishFromKoreanRouteSegment(segs[1]!)
}

function pushUniqueHanatourLandmark(
  list: string[],
  raw: string,
  productDestination: string | null | undefined,
): void {
  const kw = tryAcceptHanatourLlmImageKeyword(raw, productDestination)
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
    const kw = segmentToAcceptedHanatourKeyword(seg, productDestination)
    if (kw) pushUniqueHanatourLandmark(out, kw, productDestination)
  }
  const haystack = buildHanatourDayHaystack(row)
  for (const en of findAllMappedKoreanPoisInText(haystack)) {
    pushUniqueHanatourLandmark(out, en, productDestination)
  }
  return out
}

/** 본문·제목에 매핑된 명소가 있으면 도시명만인 LLM 1순위보다 우선(본문 등장 순) */
function preferPoiOverBareCityLlm(
  row: HanatourScheduleImageKeywordRow,
  acceptedCity: string,
  productDestination: string | null | undefined,
): string {
  const bodyHaystack = [row.title, row.description].filter(Boolean).join('\n')
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(bodyHaystack)) {
    const kw = tryAcceptHanatourLlmImageKeyword(en, productDestination)
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
  const ordered = pickLast ? [...segs].reverse() : segs
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
  const pickLast = day === maxDay && maxDay >= 2 && day !== 1
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

function resolveHanatourPrimaryKeyword(
  row: HanatourScheduleImageKeywordRow,
  dayKind: HanatourScheduleCardDayKind,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: HanatourScheduleImageKeywordRow[],
): string {
  const haystack = buildHanatourDayHaystack(row)
  const acceptLlm = (raw: string | null | undefined) =>
    tryAcceptHanatourLlmImageKeyword(raw, productDestination)
  const accepted = acceptLlm(row.imageKeyword)
  const acceptedIsLandmarkEligible =
    !!accepted &&
    !isNonLandmarkFoodOrDiningImageKeyword(accepted) &&
    (dayKind !== 'tourism' ||
      isLikelyTourismLandmarkKeyword(accepted) ||
      isKnownDestinationCityEnglishKeyword(accepted))
  if (acceptedIsLandmarkEligible) {
    const isHubOrFlight =
      isHanatourDestinationCityDay(day, maxDay, haystack) ||
      dayKind === 'movement' ||
      dayKind === 'return_home'
    if (!isHubOrFlight && isKnownDestinationCityEnglishKeyword(accepted)) {
      const fromPoi = preferPoiOverBareCityLlm(row, accepted, productDestination)
      if (fromPoi !== accepted) return fromPoi
    }
    if (dayKind === 'tourism') {
      const landmarks = collectHanatourLandmarkKeywords(row, productDestination)
      const fromRouteLast = pickForeignPlaceFromRouteText(row.routeText, true, productDestination)
      const fromRoute = pickForeignPlaceFromRouteText(row.routeText, false, productDestination)
      const dayCands = [
        ...landmarks.filter((kw) => !isKnownDestinationCityEnglishKeyword(kw)),
        fromRouteLast,
        fromRoute,
      ].filter(Boolean)
      const resolved = resolveTourismKeywordPreferDistinctPerDay({
        row,
        acceptedLlm: accepted,
        allRows,
        acceptLlm,
        daySpecificCandidates: dayCands,
      })
      if (resolved) return resolved
    }
    return accepted
  }

  if (isHanatourDestinationCityDay(day, maxDay, haystack)) {
    return resolveHanatourDestinationCityDayKeyword(row, day, maxDay, productDestination, allRows)
  }

  if (dayKind === 'movement' || dayKind === 'return_home') {
    return resolveHanatourMovementDayKeyword(row, day, maxDay, productDestination, allRows)
  }

  const landmarks = collectHanatourLandmarkKeywords(row, productDestination)
  const fromRouteLast = pickForeignPlaceFromRouteText(row.routeText, true, productDestination)
  if (fromRouteLast && !isKnownDestinationCityEnglishKeyword(fromRouteLast)) return fromRouteLast

  const fromLandmark =
    landmarks.find((kw) => !isKnownDestinationCityEnglishKeyword(kw)) ?? landmarks[0]
  if (fromLandmark) return fromLandmark

  const fromRoute = pickForeignPlaceFromRouteText(row.routeText, false, productDestination)
  if (fromRoute) return fromRoute

  return inferHanatourKeywordFromDayContent(row, productDestination)
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
  if (fromLlm && normKey(fromLlm) !== normKey(primary)) return fromLlm

  const fromRouteRaw = resolveRouteTextSecondPlace(row.routeText)
  const fromRoute = fromRouteRaw
    ? tryAcceptHanatourLlmImageKeyword(fromRouteRaw, productDestination)
    : ''
  if (
    fromRoute &&
    normKey(fromRoute) !== normKey(primary) &&
    !isKnownDestinationCityEnglishKeyword(fromRoute)
  ) {
    return fromRoute
  }

  const bodyHaystack = [row.title, row.description].filter(Boolean).join('\n')
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(bodyHaystack)) {
    const kw = tryAcceptHanatourLlmImageKeyword(en, productDestination)
    if (kw && normKey(kw) !== normKey(primary)) return kw
  }

  if (fromRoute && normKey(fromRoute) !== normKey(primary)) return fromRoute

  const landmarkCandidates = collectHanatourLandmarkKeywords(row, productDestination)
  for (const kw of landmarkCandidates) {
    if (normKey(kw) === normKey(primary)) continue
    if (!isKnownDestinationCityEnglishKeyword(kw)) return kw
  }
  if (!isKnownDestinationCityEnglishKeyword(primary)) return null
  for (const kw of landmarkCandidates) {
    if (normKey(kw) !== normKey(primary)) return kw
  }

  return null
}

export function applyHanatourScheduleImageKeywordsToRows<
  T extends HanatourScheduleImageKeywordRow,
>(rows: T[], opts?: HanatourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = opts?.productDestination ?? null

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }

    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    const primary = resolveHanatourPrimaryKeyword(row, dayKind, day, maxDay, productDestination, rows)
    const secondary = resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })
}
