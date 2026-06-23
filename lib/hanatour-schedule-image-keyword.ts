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
  isDestinationMapEnglishHubKeyword,
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

/** 하나투어 일정·routeText 한글 명소 — pexels POI 맵에 없는 홋카이도·지역 랜드마크 */
const HANATOUR_KO_POI_RULES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /죠잔케이|Jozankei|定山渓/u, en: 'Jozankei' },
  { re: /노보리베츠.*지옥|지옥\s*계곡|Jigokudani/u, en: 'Noboribetsu Jigokudani' },
  { re: /오타루\s*운하|Otaru\s*Canal/u, en: 'Otaru Canal' },
  { re: /오르골|Music\s*Box/u, en: 'Otaru Music Box Museum' },
  { re: /오도리\s*공원|Odori\s*Park/u, en: 'Odori Park' },
  { re: /도야\s*호수|Lake\s*Toya/u, en: 'Lake Toya' },
  { re: /소호\s*거리|SoHo(?!\s*Hong)/iu, en: 'SoHo Hong Kong' },
  { re: /타이쿤|Tai\s*Kwun/u, en: 'Tai Kwun' },
  { re: /헐리우드\s*로드|Hollywood\s*Road/u, en: 'Hollywood Road Hong Kong' },
  { re: /미드[-\s]*레벨\s*에스컬레이터|Mid[-\s]*level\s*Escalator/u, en: 'Mid-Levels Escalator' },
  { re: /리퉁\s*애비뉴|Li\s*Yuen|L\.?\s*Yuen/i, en: 'Li Yuen Street Hong Kong' },
  { re: /블루\s*하우스|Blue\s*House/u, en: 'Blue House Hong Kong' },
  { re: /빅토리아\s*피크|Victoria\s*Peak/u, en: 'Victoria Peak' },
  { re: /피크\s*트램|Peak\s*Tram/u, en: 'Peak Tram' },
  { re: /웡타이신|Wong\s*Tai\s*Sin/u, en: 'Wong Tai Sin Temple' },
  { re: /성\s*바울\s*성당|Ruins\s*of\s*St\.?\s*Paul|St\.?\s*Paul'?s?/iu, en: "Ruins of St. Paul's" },
  { re: /세나두\s*광장|Senado\s*Square/u, en: 'Senado Square' },
  { re: /침사추이\s*해변|연인의\s*거리|스타의\s*거리|Avenue\s*of\s*Stars/u, en: 'Avenue of Stars Hong Kong' },
]

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

const HANATOUR_SSOT_POI_EN_KEYS = new Set(
  HANATOUR_KO_POI_RULES.map(({ en }) => normKey(en)),
)

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
  const t = String(text ?? '').trim()
  if (!t) return ''
  for (const { re, en } of HANATOUR_KO_POI_RULES) {
    if (re.test(t)) return en
  }
  return ''
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
  const fromHanatourPoi = findHanatourKoPoiEn(t)
  if (fromHanatourPoi) {
    try {
      return finalizeScheduleImageKeyword(fromHanatourPoi)
    } catch {
      /* continue */
    }
  }
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
  for (const { re, en } of HANATOUR_KO_POI_RULES) {
    if (!re.test(haystack)) continue
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

  for (const { re, en } of HANATOUR_KO_POI_RULES) {
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
  for (const { re, en } of HANATOUR_KO_POI_RULES) {
    if (re.test(haystack)) pushUniqueHanatourLandmark(out, en, productDestination)
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
  for (const { re, en } of HANATOUR_KO_POI_RULES) {
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

/** HANATOUR_KO_POI_RULES 등 SSOT 매핑 — 짧은 도시명(Otaru 등) weak-opaque 우회 */
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
    for (const { re, en } of HANATOUR_KO_POI_RULES) {
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

  if (dayKind === 'tourism') {
    const fromSchedule = pickFirstUnusedHanatourScheduleLandmark(row, productDestination, usedPrimary)
    if (fromSchedule) return fromSchedule
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
    const fromSchedule = pickFirstUnusedHanatourScheduleLandmark(row, productDestination, usedPrimary)
    if (fromSchedule) return fromSchedule
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

export function applyHanatourScheduleImageKeywordsToRows<
  T extends HanatourScheduleImageKeywordRow,
>(rows: T[], opts?: HanatourScheduleImageKeywordOpts): T[] {
  const prevSectionByDay = activeHanatourScheduleSectionByDay
  activeHanatourScheduleSectionByDay = opts?.scheduleSectionByDay ?? null
  try {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = opts?.productDestination ?? null
  const usedPrimary = new Set<string>()
  const sortedByDay = [...sorted].sort((a, b) => Number(a.day) - Number(b.day))
  const assignedByDay = new Map<number, { primary: string; secondary: string | null }>()

  for (const row of sortedByDay) {
    const day = Number(row.day)
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    const primary = resolveHanatourPrimaryKeyword(
      row,
      dayKind,
      day,
      maxDay,
      productDestination,
      rows,
      opts,
      usedPrimary,
    )
    const secondary = resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination)
    assignedByDay.set(day, { primary, secondary })
  }

  const mapped = rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }

    const assigned = assignedByDay.get(day)
    return {
      ...row,
      imageKeyword: assigned?.primary ?? '',
      imageKeyword2: assigned?.secondary ?? null,
    }
  })

  const deduped = dedupeHanatourTourismPrimaryKeywordsAcrossDays(mapped, maxDay, productDestination)

  const withReturnHome = deduped.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'return_home') return row
    const primary = String(row.imageKeyword ?? '').trim()
    const sectionBody =
      activeHanatourScheduleSectionByDay && day > 0
        ? String(activeHanatourScheduleSectionByDay.get(day) ?? '').trim()
        : ''
    const primaryFromThisDayScheduleSection =
      primary.length > 0 &&
      sectionBody.length >= 20 &&
      collectHanatourOrderedScheduleLandmarks(row, productDestination).some(
        (kw) => normKey(kw) === normKey(primary),
      )
    if (primaryFromThisDayScheduleSection) return row
    const fromLast = findLastResolvedHanatourTourismKeywordBeforeDay(deduped, day, maxDay)
    return fromLast ? { ...row, imageKeyword: fromLast } : row
  })

  return withReturnHome.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const primary = String(row.imageKeyword ?? '').trim()
    const k2raw = String(row.imageKeyword2 ?? '').trim()
    const needsKw2Reconcile =
      shouldReconcileScheduleImageKeyword2(primary, row.imageKeyword2) ||
      (k2raw.length > 0 && isHanatourBareCityKeyword(k2raw))
    if (!needsKw2Reconcile) return row
    const haystack = buildHanatourDayHaystack(row)
    const dayKind = classifyHanatourScheduleCardDayKind(day, maxDay, haystack)
    const secondary = resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination)
    return { ...row, imageKeyword2: secondary }
  })
  } finally {
    activeHanatourScheduleSectionByDay = prevSectionByDay
  }
}
