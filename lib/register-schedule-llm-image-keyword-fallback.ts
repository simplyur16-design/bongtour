/**
 * 일정 imageKeyword — Gemini 출력 우선, 검증·최소 추론만.
 * 공급사별 `*-schedule-image-keyword.ts` 에서 공통 사용.
 */
import { extractPlaceNameKeyword } from '@/lib/pexels-place-name-keyword'
import { mapDestination, mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { finalizeScheduleImageKeyword, normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export type ScheduleRowTextForKeyword = {
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
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
    .map((s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 2)
}

function routeTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText)
}

function englishFromKoreanSegment(seg: string): string {
  const t = seg.trim()
  if (!t) return ''
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
    const ko = englishFromKoreanSegment(seg)
    if (ko) return ko
  }

  for (const seg of [row.title, row.description].map((s) => String(s ?? '').trim()).filter(Boolean)) {
    const ko = englishFromKoreanSegment(seg)
    if (ko) return ko
  }

  return ''
}
