import {
  classifyHanatourScheduleCardDayKind,
  type HanatourScheduleCardDayKind,
} from '@/lib/parse-and-register-hanatour-schedule'
import {
  acceptLlmScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { mapDestination, mapKoreanPoiSegment, normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { finalizeScheduleImageKeyword, normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

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

/** routeText에 이미 영문으로 적힌 해외 도시·명소(매핑 없음) */
function pickEnglishRouteTextPlace(routeText: string | null | undefined, pickLast: boolean): string {
  const segs = routeTextSegments(routeText).filter(
    (s) => isLatinRoutePlaceSegment(s) && !isHanatourDomesticHubToken(s),
  )
  if (!segs.length) return ''
  const raw = pickLast ? segs[segs.length - 1]! : segs[0]!
  try {
    return finalizeScheduleImageKeyword(raw)
  } catch {
    return ''
  }
}

/** LLM 1순위 imageKeyword 형식 — 라틴·1~10단어·toxic/한글/일정노이즈 제외 (단일 도시명 허용) */
function isHanatourLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 3 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (HANATOUR_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (HANATOUR_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
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

function resolveHanatourPrimaryKeyword(
  row: HanatourScheduleImageKeywordRow,
  dayKind: HanatourScheduleCardDayKind,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
): string {
  const accepted = tryAcceptHanatourLlmImageKeyword(row.imageKeyword, productDestination)
  if (accepted) return accepted

  if (dayKind === 'movement' || dayKind === 'return_home') {
    const pickLast = day === maxDay && maxDay >= 2
    const fromRoute = pickEnglishRouteTextPlace(row.routeText, pickLast)
    if (fromRoute) return fromRoute
    return inferHanatourKeywordFromDayContent(row, productDestination)
  }

  const fromRoute = pickEnglishRouteTextPlace(row.routeText, false)
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
  if (fromRoute && normKey(fromRoute) !== normKey(primary)) return fromRoute

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
    const primary = resolveHanatourPrimaryKeyword(row, dayKind, day, maxDay, productDestination)
    const secondary = resolveHanatourSecondaryKeyword(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })
}
