/**
 * REGRESSION-FREEZE[hanatour-schedule-image-keyword-landmark]: 자유여행 imageKeyword — 식당·카페 금지, 랜드마크만 — manifest
 * REGRESSION-FREEZE[hanatour-register-kk-live-gate]: dedupe·imageKeyword2 reconcile — manifest
 * REGRESSION-FREEZE[gemini-client-client-bundle]: hanatour 등록 파서 import 금지 — manifest
 */
import {
  classifyHanatourScheduleCardDayKind,
  type HanatourScheduleCardDayKind,
} from '@/lib/hanatour-schedule-card-day-kind'
import {
  acceptLlmScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  pickDistinctSecondScheduleImageKeyword,
  resolveTourismKeywordPreferDistinctPerDay,
  shouldReconcileScheduleImageKeyword2,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  extractEnglishPoiFromLabel,
  findAllMappedKoreanPoisInText,
  findMappedKoreanPoisInTextByMentionOrder,
  isKnownDestinationCityEnglishKeyword,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
} from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkRouteTextSegment,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
  isScheduleImageKeywordLandmarkEligible,
  isWeakOpaqueImageKeyword,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'

export type HanatourScheduleImageKeywordOpts = {
  productDestination?: string | null
  /** 패키지 자유관광일 — 선택관광 카탈로그에서 예시 imageKeyword */
  optionalTourNames?: readonly string[]
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

/** routeText 전 구간 — primary와 다른 첫 수용 가능 장소(이동 순서) */
function pickDistinctPlaceFromRouteText(
  routeText: string | null | undefined,
  primary: string,
  productDestination: string | null | undefined,
): string {
  const primaryNk = normKey(primary)
  for (const seg of routeTextSegments(routeText)) {
    if (isHanatourDomesticHubToken(seg)) continue
    const raw = extractLatinEnglishFromRouteSegment(seg) || englishFromKoreanRouteSegment(seg)
    const kw = raw ? tryAcceptHanatourLlmImageKeyword(raw, productDestination) : ''
    if (kw && normKey(kw) !== primaryNk) return kw
  }
  return ''
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
    if (isNonLandmarkRouteTextSegment(seg)) continue
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
): string {
  const haystack = buildHanatourDayHaystack(row)
  const acceptLlm = (raw: string | null | undefined) =>
    tryAcceptHanatourLlmImageKeyword(raw, productDestination)
  const accepted = acceptLlm(row.imageKeyword)

  if (dayKind === 'return_home') {
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
    if (example) return example
    return ''
  }

  const acceptedIsLandmarkEligible =
    !!accepted &&
    (dayKind === 'tourism'
      ? isScheduleImageKeywordLandmarkEligible(accepted) || isKnownDestinationCityEnglishKeyword(accepted)
      : !isNonLandmarkFoodOrDiningImageKeyword(accepted) &&
        !isNonLandmarkSpaShoppingLoungeImageKeyword(accepted) &&
        !isWeakOpaqueImageKeyword(accepted) &&
        (isKnownDestinationCityEnglishKeyword(accepted) || isScheduleImageKeywordLandmarkEligible(accepted)))
  if (acceptedIsLandmarkEligible) {
    const isHubOrFlight =
      isHanatourDestinationCityDay(day, maxDay, haystack) ||
      dayKind === 'movement'
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

  if (dayKind === 'movement') {
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

  const fromRoute = pickDistinctPlaceFromRouteText(row.routeText, primary, productDestination)
  if (
    fromRoute &&
    !isKnownDestinationCityEnglishKeyword(fromRoute)
  ) {
    return fromRoute
  }

  const bodyHaystack = [row.title, row.description].filter(Boolean).join('\n')
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(bodyHaystack)) {
    const kw = tryAcceptHanatourLlmImageKeyword(en, productDestination)
    if (kw && normKey(kw) !== normKey(primary)) return kw
  }

  const rawLandmarks = collectHanatourLandmarkKeywords(row, productDestination)
  const fromOrdered = pickDistinctSecondScheduleImageKeyword(primary, rawLandmarks)
  if (fromOrdered) {
    const accepted = tryAcceptHanatourLlmImageKeyword(fromOrdered, productDestination)
    if (accepted && normKey(accepted) !== normKey(primary)) return accepted
    if (normKey(fromOrdered) !== normKey(primary)) return fromOrdered
  }

  if (fromRoute) return fromRoute

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
    for (const kw of collectHanatourLandmarkKeywords(row, productDestination)) push(kw)
    push(pickForeignPlaceFromRouteText(row.routeText, true, productDestination))
    push(pickForeignPlaceFromRouteText(row.routeText, false, productDestination))
    push(inferHanatourKeywordFromDayContent(row, productDestination))
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

export function applyHanatourScheduleImageKeywordsToRows<
  T extends HanatourScheduleImageKeywordRow,
>(rows: T[], opts?: HanatourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = opts?.productDestination ?? null

  const mapped = rows.map((row) => {
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
    const primary = resolveHanatourPrimaryKeyword(row, dayKind, day, maxDay, productDestination, rows, opts)
    const secondary = resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })

  const deduped = dedupeHanatourTourismPrimaryKeywordsAcrossDays(mapped, maxDay, productDestination)

  const withReturnHome = deduped.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'return_home') return row
    const fromLast = findLastResolvedHanatourTourismKeywordBeforeDay(deduped, day, maxDay)
    return fromLast ? { ...row, imageKeyword: fromLast } : row
  })

  return withReturnHome.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const primary = String(row.imageKeyword ?? '').trim()
    if (!shouldReconcileScheduleImageKeyword2(primary, row.imageKeyword2)) return row
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    const secondary = resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination)
    return { ...row, imageKeyword2: secondary }
  })
}
