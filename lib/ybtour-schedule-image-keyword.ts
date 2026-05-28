/**
 * 노랑풍선(ybtour): 일차 imageKeyword(1순위)·imageKeyword2(2순위) — Pexels용 영문.
 * kw1: augment det 결과 유지(비행일만 routeText 해외 도시로 강제).
 * kw2: dayKind 게이트 + LLM 우선 + det 2순위 폴백.
 * routeText는 dayKind 게이트·비행일 kw1용만(KO→EN). 관광 키워드 텍스트 소스로 쓰지 않음.
 */
import { mapDestination } from '@/lib/pexels-keyword'
import { extractSecondaryEnglishPlaceName } from '@/lib/english-schedule-place-extract'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { finalizeScheduleImageKeyword, normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import { buildEnglishPlaceTripartiteImageKeyword } from '@/lib/register-schedule-english-place-image-keyword'

export type YbtourScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type YbtourDayKind = 'flight' | 'touring' | 'free'

export type YbtourScheduleImageKeywordOpts = {
  productDestination?: string | null
  totalDays?: number
}

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const YBTOUR_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const YBTOUR_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

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

function dayHaystack(description: string, title: string, routeText?: string | null): string {
  return [title, description, routeText].filter(Boolean).join('\n')
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function routeTextSegments(routeText: string | null | undefined): string[] {
  const rt = String(routeText ?? '').trim()
  if (!rt) return []
  return rt
    .split(/\s*-\s*/)
    .map(stripRouteSegmentNoise)
    .filter((s) => s.length >= 2)
}

/** 인천·부산·대구·청주·김포·ICN/GMP 등 — imageKeyword 후보에서 제외 */
export function isYbtourDomesticHubToken(token: string): boolean {
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

/** 아시아·태평양 목적지 상품에서 LLM이 헛생성한 타대륙 유명 랜드마크 */
export function isYbtourCrossContinentHallucinationKeyword(
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

function countYbtourNonHubRouteTextSegments(routeText: string | null | undefined): number {
  let count = 0
  for (const p of routeTextSegments(routeText)) {
    if (isYbtourDomesticHubToken(p)) continue
    count++
  }
  return count
}

function hasYbtourFlightDaySignals(
  description: string,
  title: string,
  routeText: string | null | undefined,
): boolean {
  const hay = dayHaystack(description, title, routeText)
  if (routeTextSegments(routeText).some((s) => isYbtourDomesticHubToken(s))) return true
  if (
    /(?:인천|김포|부산|대구|청주|김해|서울|제주|ICN|GMP|PUS|TAE|CJJ)(?:국제)?\s*공항/u.test(hay) &&
    /(?:출발|도착|탑승|귀국|입국|경유)/u.test(hay)
  ) {
    return true
  }
  if (
    /(?:출발|도착|귀국|국제\s*선|비행|항공)/u.test(hay) &&
    /(?:인천|김포|부산|대구|청주|ICN|GMP|PUS|TAE|CJJ)/u.test(hay)
  ) {
    return true
  }
  return false
}

export function classifyYbtourDayKind(
  description: string,
  title: string,
  routeText: string | null | undefined,
  _dayIndex: number,
  _totalDays: number,
): YbtourDayKind {
  if (hasYbtourFlightDaySignals(description, title, routeText)) return 'flight'
  if (countYbtourNonHubRouteTextSegments(routeText) >= 3) return 'touring'
  return 'free'
}

function isYbtourLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 2 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (YBTOUR_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (YBTOUR_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

function tryAcceptYbtourLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  const llmRaw = String(raw ?? '').trim()
  if (!llmRaw || !isYbtourLlmImageKeywordFormatOk(llmRaw)) return ''
  if (isYbtourDomesticHubToken(llmRaw)) return ''
  if (isYbtourCrossContinentHallucinationKeyword(llmRaw, productDestination)) return ''
  try {
    return finalizeScheduleImageKeyword(llmRaw)
  } catch {
    return ''
  }
}

/** 비행일: routeText 첫 해외(비허브) 세그먼트 → 공용 KO→EN */
function pickOverseasCityEnglishFromRouteText(routeText: string | null | undefined): string {
  const segs = routeTextSegments(routeText).filter((s) => !isYbtourDomesticHubToken(s))
  if (!segs.length) return ''
  const koSeg = segs[0]!
  let en = ''
  try {
    en = finalizeScheduleImageKeyword(
      buildEnglishPlaceTripartiteImageKeyword({
        title: koSeg,
        description: koSeg,
        rawDayBody: '',
      }),
    ).slice(0, 180)
  } catch {
    en = ''
  }
  if (!en) {
    const mapped = mapDestination(koSeg)
    if (mapped) {
      try {
        en = finalizeScheduleImageKeyword(mapped).slice(0, 180)
      } catch {
        en = ''
      }
    }
  }
  return en
}

export function resolveYbtourPrimaryKeyword(
  row: YbtourScheduleImageKeywordRow,
  dayKind: YbtourDayKind,
): string {
  const existing = String(row.imageKeyword ?? '').trim()
  const kw =
    dayKind !== 'flight'
      ? existing
      : pickOverseasCityEnglishFromRouteText(row.routeText) || existing
  if (isYbtourDomesticHubToken(kw)) return ''
  return kw
}

export function resolveYbtourSecondaryKeyword(
  row: YbtourScheduleImageKeywordRow,
  primary: string,
  dayKind: YbtourDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (dayKind !== 'touring') return null
  if (!primary) return null

  const fromLlm = tryAcceptYbtourLlmImageKeyword(row.imageKeyword2, productDestination)
  if (fromLlm && !keysEqual(fromLlm, primary)) return fromLlm

  const desc = String(row.description ?? '').trim()
  const title = String(row.title ?? '').trim()
  const fromDetRaw = extractSecondaryEnglishPlaceName(desc, desc, title, primary)
  if (!fromDetRaw) return null
  if (isYbtourDomesticHubToken(fromDetRaw)) return null
  if (isYbtourCrossContinentHallucinationKeyword(fromDetRaw, productDestination)) return null
  try {
    const fromDet = finalizeScheduleImageKeyword(fromDetRaw)
    if (!fromDet || keysEqual(fromDet, primary)) return null
    return fromDet
  } catch {
    return null
  }
}

export function applyYbtourScheduleImageKeywordsToRows<
  T extends YbtourScheduleImageKeywordRow,
>(rows: T[], opts?: YbtourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const totalDays =
    opts?.totalDays ??
    (sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 0)
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

    const title = String(row.title ?? '').trim()
    const description = String(row.description ?? '').trim()
    const dayKind = classifyYbtourDayKind(description, title, row.routeText ?? null, day, totalDays)
    const primary = resolveYbtourPrimaryKeyword(row, dayKind)
    const secondary = resolveYbtourSecondaryKeyword(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })
}
