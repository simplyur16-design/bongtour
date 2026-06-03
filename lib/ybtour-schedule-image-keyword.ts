/**
 * 노랑풍선(ybtour): 일차 imageKeyword(1·2순위) — routeText(일정 요약 A-B-C-D)에서 두 곳만.
 * 국내 공항·허브는 건너뛰고, 남은 세그먼트 순서대로 1순위·2순위에 KO→EN 매핑한다.
 */
import { mapDestination, mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'

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

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function keysEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  return normKey(a) === normKey(b)
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function routeTextSegments(routeText: string | null | undefined): string[] {
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

function englishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isYbtourDomesticHubToken(t)) return ''

  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    try {
      return finalizeScheduleImageKeyword(fromPoi)
    } catch {
      /* continue */
    }
  }

  const fromDest = mapDestination(t)
  if (fromDest && fromDest !== t && !/[\uAC00-\uD7AF]/.test(fromDest)) {
    try {
      return finalizeScheduleImageKeyword(fromDest)
    } catch {
      /* continue */
    }
  }

  if (/^[A-Za-z][A-Za-z0-9\s,.'-]{2,}$/.test(t) && !/[\uAC00-\uD7AF]/.test(t)) {
    try {
      return finalizeScheduleImageKeyword(t)
    } catch {
      return ''
    }
  }

  return ''
}

/** routeText A-B-C-D → 1·2순위 영문 키워드(중복·허브 제외, 순서 유지) */
export function pickYbtourImageKeywordsFromRouteText(routeText: string | null | undefined): {
  imageKeyword: string
  imageKeyword2: string | null
} {
  const picked: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    const en = englishFromRouteSegment(seg)
    if (!en) continue
    if (picked.some((p) => keysEqual(p, en))) continue
    picked.push(en)
    if (picked.length >= 2) break
  }
  return {
    imageKeyword: picked[0] ?? '',
    imageKeyword2: picked[1] ?? null,
  }
}

function countYbtourNonHubRouteTextSegments(routeText: string | null | undefined): number {
  let count = 0
  for (const p of routeTextSegments(routeText)) {
    if (isYbtourDomesticHubToken(p)) continue
    count++
  }
  return count
}

function dayHaystack(description: string, title: string, routeText?: string | null): string {
  return [title, description, routeText].filter(Boolean).join('\n')
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

/** dayKind — 레거시·테스트 호환(키워드 SSOT는 routeText 2곳) */
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

/** @deprecated routeText 2곳 규칙 — `pickYbtourImageKeywordsFromRouteText` 사용 */
export function isYbtourCrossContinentHallucinationKeyword(
  _keyword: string,
  _productDestination: string | null | undefined,
): boolean {
  return false
}

/** @deprecated routeText 2곳 규칙 */
export function isYbtourKeywordSupportedByDayContent(
  _keyword: string,
  _title: string,
  _description: string,
  _routeText: string | null | undefined,
): boolean {
  return false
}

export function resolveYbtourPrimaryKeyword(
  row: YbtourScheduleImageKeywordRow,
  _dayKind: YbtourDayKind,
  _productDestination: string | null | undefined,
): string {
  return pickYbtourImageKeywordsFromRouteText(row.routeText ?? null).imageKeyword
}

export function resolveYbtourSecondaryKeyword(
  row: YbtourScheduleImageKeywordRow,
  primary: string,
  _dayKind: YbtourDayKind,
  _productDestination: string | null | undefined,
): string | null {
  if (!primary) return null
  const kw2 = pickYbtourImageKeywordsFromRouteText(row.routeText ?? null).imageKeyword2
  if (!kw2 || keysEqual(kw2, primary)) return null
  return kw2
}

export function applyYbtourScheduleImageKeywordsToRows<
  T extends YbtourScheduleImageKeywordRow,
>(rows: T[], _opts?: YbtourScheduleImageKeywordOpts): T[] {
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }

    const { imageKeyword, imageKeyword2 } = pickYbtourImageKeywordsFromRouteText(row.routeText ?? null)
    return {
      ...row,
      imageKeyword,
      imageKeyword2,
    }
  })
}
