/**
 * 모두투어 전용: `Product.schedule[].imageKeyword` / `imageKeyword2` — Pexels 검색용 영문.
 * LLM 영문 그대로 사용, routeText 라틴 세그먼트 폴백만. 매핑·고정폴백 없음.
 */
import {
  acceptLlmScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  resolveTourismKeywordPreferDistinctPerDay,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { finalizeScheduleImageKeyword, normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export type ModetourScheduleImageKeywordOpts = {
  productDestination?: string | null
  productTitle?: string
  pastedBlob?: string
}

export type ModetourScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

type ModetourScheduleCardDayKind = 'tourism' | 'movement' | 'return_home'

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const MODETOUR_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const MODETOUR_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

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

/** LLM/파서 placeholder·불량 패턴 */
export function isModetourPlaceholderImageKeyword(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^day\s*\d+\s*travel$/i.test(t)) return true
  if (/^제\s*\d+\s*일차(?:\s*일정)?$/u.test(t)) return true
  if (/^real\s+place\s+name\s+in\s+english$/i.test(t)) return true
  return false
}

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function buildModetourDayHaystack(row: ModetourScheduleImageKeywordRow): string {
  return [row.title, row.description, row.routeText].filter(Boolean).join('\n').replace(/\r/g, '')
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isModetourDomesticHubToken(token: string): boolean {
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

function pickEnglishRouteTextPlace(routeText: string | null | undefined, pickLast: boolean): string {
  const segs = routeTextSegments(routeText).filter(
    (s) => isLatinRoutePlaceSegment(s) && !isModetourDomesticHubToken(s),
  )
  if (!segs.length) return ''
  const raw = pickLast ? segs[segs.length - 1]! : segs[0]!
  try {
    return finalizeScheduleImageKeyword(raw)
  } catch {
    return ''
  }
}

function isModetourLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 3 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (MODETOUR_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (MODETOUR_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

export function isModetourCrossContinentHallucinationKeyword(
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

function extractLatinEnglishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isModetourDomesticHubToken(t)) return ''
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

function resolveRouteTextSecondLatinPlace(routeText: string | null | undefined): string {
  const segs = routeTextSegments(routeText)
  if (segs.length < 2) return ''
  return extractLatinEnglishFromRouteSegment(segs[1]!)
}

function tryAcceptModetourLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  return acceptLlmScheduleImageKeyword(raw, {
    productDestination,
    isFormatOk: isModetourLlmImageKeywordFormatOk,
    isDomesticHub: isModetourDomesticHubToken,
    isCrossContinentHallucination: isModetourCrossContinentHallucinationKeyword,
  })
}

function inferModetourKeywordFromDayContent(
  row: ModetourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  const inferred = inferEnglishPlaceKeywordFromDayContent(row, productDestination)
  if (!inferred) return ''
  return tryAcceptModetourLlmImageKeyword(inferred, productDestination)
}

export function classifyModetourScheduleCardDayKind(
  day: number,
  maxDay: number,
  joined: string,
): ModetourScheduleCardDayKind {
  const j = joined.slice(0, 12_000)
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|호치민|방콕|Bangkok|Tokyo|Osaka)/i.test(j)
  ) {
    return 'return_home'
  }
  if (day === maxDay && maxDay >= 2 && /(귀국|인천\s*도착|ICN\s*도착|서울\s*도착)/.test(j) && /출발/.test(j)) {
    return 'return_home'
  }
  if (day === 1 && /출발/.test(j) && /(도착|입국)/.test(j) && /(공항|ICN|PVG|GMP|김포|인천|부산|PUS|대구|TAE|청주|CJJ)/.test(j)) {
    return 'movement'
  }
  if (
    day === 1 &&
    /(입국|도착|공항|피켓|미팅)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|김포|인천|부산)/i.test(j) &&
    /(가이드|호텔|공항|출발|탑승)/.test(j)
  ) {
    return 'movement'
  }
  return 'tourism'
}

function resolveModetourPrimaryKeyword(
  row: ModetourScheduleImageKeywordRow,
  dayKind: ModetourScheduleCardDayKind,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: ModetourScheduleImageKeywordRow[],
): string {
  const acceptLlm = (raw: string | null | undefined) =>
    tryAcceptModetourLlmImageKeyword(raw, productDestination)
  const accepted = acceptLlm(row.imageKeyword)

  if (dayKind === 'tourism' && accepted) {
    const fromRouteLast = pickEnglishRouteTextPlace(row.routeText, true)
    const fromRouteFirst = pickEnglishRouteTextPlace(row.routeText, false)
    const fromInfer = inferModetourKeywordFromDayContent(row, productDestination)
    const resolved = resolveTourismKeywordPreferDistinctPerDay({
      row,
      acceptedLlm: accepted,
      allRows,
      acceptLlm,
      daySpecificCandidates: [fromRouteLast, fromRouteFirst, fromInfer].filter((k): k is string =>
        Boolean(k),
      ),
    })
    if (resolved) return resolved
  }

  if (accepted) return accepted

  if (dayKind === 'movement' || dayKind === 'return_home') {
    const pickLast = day === maxDay && maxDay >= 2
    const fromRoute = pickEnglishRouteTextPlace(row.routeText, pickLast)
    if (fromRoute) return fromRoute
    return inferModetourKeywordFromDayContent(row, productDestination)
  }

  const fromRoute = pickEnglishRouteTextPlace(row.routeText, false)
  if (fromRoute) return fromRoute

  return inferModetourKeywordFromDayContent(row, productDestination)
}

function resolveModetourSecondaryKeyword(
  row: ModetourScheduleImageKeywordRow,
  primary: string,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (!primary) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const fromLlm = tryAcceptModetourLlmImageKeyword(row.imageKeyword2, productDestination)
  if (fromLlm && normKey(fromLlm) !== normKey(primary)) return fromLlm

  const fromRouteRaw = resolveRouteTextSecondLatinPlace(row.routeText)
  const fromRoute = fromRouteRaw
    ? tryAcceptModetourLlmImageKeyword(fromRouteRaw, productDestination)
    : ''
  if (fromRoute && normKey(fromRoute) !== normKey(primary)) return fromRoute

  return null
}

export function applyModetourScheduleImageKeywordsToRows<
  T extends ModetourScheduleImageKeywordRow,
>(rows: T[], opts?: ModetourScheduleImageKeywordOpts): T[] {
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

    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    const primary = resolveModetourPrimaryKeyword(row, dayKind, day, maxDay, productDestination, sorted)
    const secondary = resolveModetourSecondaryKeyword(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })
}
