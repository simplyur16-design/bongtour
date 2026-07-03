/**
 * 일정 imageKeyword — Gemini 출력 우선, 검증·최소 추론만.
 * 공급사별 `*-schedule-image-keyword.ts` 에서 공통 사용.
 *
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: 관광 일차 imageKeyword + imageKeyword2(1≠2).
 * REGRESSION-FREEZE[hanatour-register-kk-live-gate]: return_home·free-day example keyword — manifest
 * 공급사별 모듈은 이 파일의 2순위·dedupe 후 reconcile 헬퍼를 공유한다 — 한 공급사만 고치지 말 것.
 */
import { extractPlaceNameKeyword } from '@/lib/pexels-place-name-keyword'
import {
  extractEnglishPoiFromLabel,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
} from '@/lib/pexels-keyword'
import { findAllScheduleSpotMatchesInText, firstMatchingScheduleCityEn } from '@/lib/schedule-poi-regex-ssot'
import { finalizeScheduleImageKeyword, normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

function normKeywordKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

/** 공급사 SSOT 비교용 — imageKeyword / imageKeyword2 동일 여부 */
export function normScheduleImageKeywordKey(s: string): string {
  return normKeywordKey(s)
}

/** 이동 순서 후보 목록에서 1순위와 다른 첫 번째 2순위 */
export function pickDistinctSecondScheduleImageKeyword(
  primary: string,
  candidates: readonly string[],
): string | null {
  const pk = normKeywordKey(String(primary ?? '').trim())
  if (!pk) return null
  for (const raw of candidates) {
    const kw = String(raw ?? '').trim()
    if (!kw) continue
    if (normKeywordKey(kw) !== pk) return kw
  }
  return null
}

/** 1순위 dedupe·교체 후 2순위를 다시 채워야 하는지 */
export function shouldReconcileScheduleImageKeyword2(
  primary: string,
  imageKeyword2: string | null | undefined,
): boolean {
  const p = String(primary ?? '').trim()
  if (!p) return false
  const k2 = String(imageKeyword2 ?? '').trim()
  if (!k2) return true
  return normKeywordKey(k2) === normKeywordKey(p)
}

export type ScheduleRowTextForKeyword = {
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
}

/** 전일 자유·자유시간 일정 — 선택관광 예시 키워드 후보 대상(도시명만 넣지 않음) */
export function isRegisterScheduleFreeLeisureDay(haystack: string): boolean {
  const h = String(haystack ?? '').slice(0, 8_000)
  if (!h.trim()) return false
  if (!/전\s*일정\s*자유|자유\s*시간|자유\s*일정|자유일정|free\s*time|at\s+leisure/i.test(h)) return false
  if (/(관광|방문|탐방|투어|체험|국립|공원|사원|유적|박물관|폭포|섬)/u.test(h)) return false
  return true
}

/** optionalToursStructured JSON → 선택관광명 목록 */
export function parseOptionalTourNamesFromStructuredJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return ''
        const o = x as Record<string, unknown>
        return String(o.name ?? o.tourName ?? o.title ?? '').trim()
      })
      .filter((n) => n.length > 1)
  } catch {
    return []
  }
}

export type AcceptLlmScheduleImageKeywordOpts = {
  productDestination?: string | null
  isFormatOk: (kw: string) => boolean
  isDomesticHub: (kw: string) => boolean
  isCrossContinentHallucination: (kw: string, productDestination: string | null | undefined) => boolean
}

/** LLM 문자열 → Pexels용 영문 고유명(통과 시만). normalize 후 형식 검사. */
export function acceptLlmScheduleImageKeyword(
  raw: string | null | undefined,
  opts: AcceptLlmScheduleImageKeywordOpts,
): string {
  const llmRaw = String(raw ?? '').trim()
  if (!llmRaw) return ''

  const candidates = [llmRaw, normalizeToPlaceName(llmRaw)].filter(
    (c, i, arr) => c && arr.indexOf(c) === i,
  )

  for (const candidate of candidates) {
    if (!opts.isFormatOk(candidate)) continue
    if (opts.isDomesticHub(candidate)) continue
    if (opts.isCrossContinentHallucination(candidate, opts.productDestination ?? null)) continue
    try {
      return finalizeScheduleImageKeyword(candidate)
    } catch {
      continue
    }
  }
  return ''
}

/** 이동 경로 — ` - `·쉼표·화살표 등으로 구분된 지명 토큰(하나투어·모두투어 공통). */
export function splitRouteTextPlaceSegments(routeText: string | null | undefined): string[] {
  const rt = String(routeText ?? '').trim()
  if (!rt) return []
  return rt
    .split(/\s*(?:→|->|—|–|,|，|·|\/|\s+-\s+)\s*/u)
    .map((s) =>
      s
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((s) => s.length >= 2 || /[\uAC00-\uD7AF]/u.test(s))
}

function routeTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText)
}

/** routeText 세그먼트 한글 → 영문: 일정에 나온 지명을 POI 사전·도시 사전으로만 변환(지역 ROI 테이블 없음). */
export function englishFromScheduleKoreanSegment(seg: string): string {
  const t = seg.trim()
  if (!t) return ''
  // REGRESSION-FREEZE[schedule-korean-segment-poi-before-regex]: POI 사전 → findAllScheduleSpotMatchesInText 좌→우 — manifest
  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    try {
      return finalizeScheduleImageKeyword(fromPoi)
    } catch {
      return fromPoi
    }
  }
  const spotHits = findAllScheduleSpotMatchesInText(t)
  const fromSpotRegex = spotHits[0]?.en ?? ''
  if (fromSpotRegex) {
    try {
      return finalizeScheduleImageKeyword(fromSpotRegex)
    } catch {
      return fromSpotRegex
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
  const fromCityRegex = firstMatchingScheduleCityEn(t)
  if (fromCityRegex) {
    try {
      return finalizeScheduleImageKeyword(fromCityRegex)
    } catch {
      return fromCityRegex
    }
  }
  return ''
}

/**
 * LLM·routeText·title·description 에서 영문 관광지/도시명 추론(한글 routeText 포함).
 * 환각·허브 검사는 호출부 `acceptLlm*` 로 한 번 더 거친다.
 */
export function inferEnglishPlaceKeywordFromDayContent(
  row: ScheduleRowTextForKeyword,
  productDestination?: string | null,
): string {
  const destEn = productDestination ? mapDestination(productDestination) : ''
  const haystack = [row.title, row.description, row.routeText].filter(Boolean).join('\n')

  const fromExtract = extractPlaceNameKeyword({
    llmImageKeyword: row.imageKeyword ?? undefined,
    title: row.title ?? '',
    description: row.description ?? '',
    rawBody: haystack,
    cityEn: destEn || undefined,
    countryEn: destEn || undefined,
  })
  if (fromExtract) {
    try {
      return finalizeScheduleImageKeyword(fromExtract)
    } catch {
      /* continue */
    }
  }

  for (const seg of routeTextSegments(row.routeText)) {
    if (/^[A-Za-z][A-Za-z0-9\s,.'-]{2,}$/.test(seg) && !/[\uAC00-\uD7AF]/.test(seg)) {
      try {
        return finalizeScheduleImageKeyword(seg)
      } catch {
        /* continue */
      }
    }
    const ko = englishFromScheduleKoreanSegment(seg)
    if (ko) return ko
  }

  for (const seg of [row.title, row.description].map((s) => String(s ?? '').trim()).filter(Boolean)) {
    const ko = englishFromScheduleKoreanSegment(seg)
    if (ko) return ko
  }

  return ''
}

/**
 * 관광 일차: LLM imageKeyword가 여러 일차에 동일 반복(상품명 바나힐 등)이면
 * 일차별 routeText·본문 명소 후보를 우선한다.
 */
export function resolveTourismKeywordPreferDistinctPerDay<T extends ScheduleRowTextForKeyword>(args: {
  row: T
  acceptedLlm: string
  allRows: T[]
  acceptLlm: (raw: string | null | undefined) => string
  daySpecificCandidates: string[]
}): string {
  const cands = args.daySpecificCandidates.map((k) => String(k ?? '').trim()).filter(Boolean)
  if (!cands.length) return args.acceptedLlm

  const pickFirstDistinct = (): string => {
    for (const kw of cands) {
      if (!args.acceptedLlm || normKeywordKey(kw) !== normKeywordKey(args.acceptedLlm)) return kw
    }
    return cands[0]!
  }

  if (!args.acceptedLlm) return pickFirstDistinct()

  const llmKey = normKeywordKey(args.acceptedLlm)
  let dup = 0
  for (const r of args.allRows) {
    const a = args.acceptLlm(r.imageKeyword)
    if (a && normKeywordKey(a) === llmKey) dup++
  }
  if (dup >= 2) {
    const distinct = pickFirstDistinct()
    if (normKeywordKey(distinct) !== llmKey) return distinct
  }
  return args.acceptedLlm
}
