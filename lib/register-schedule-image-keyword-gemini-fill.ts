/**
 * routeText 규칙·POI 사전 후에도 imageKeyword가 비는 일차 — Gemini로 영문 랜드마크 1·2순위 생성.
 * 자유일정 일차 — 도시·반나절/1day를 파악한 뒤 제미나이 추천일정을 일정에 쓰고 키워드를 맞춘다.
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: manifest
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — FIT·환승 제외 — manifest
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { classifyModetourScheduleCardDayKind, isModetourDomesticHubToken } from '@/lib/modetour-schedule-image-keyword'
import { mapDestination } from '@/lib/pexels-keyword'
import { isHotelLodgingImageKeyword } from '@/lib/pexels-place-name-keyword'
import { isRegisterPrePhotoPlaceLikeDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'
import {
  hasRegisterFreeDayRecommendedItinerary,
  inferRegisterPendingDestinationFromTitle,
  isRegisterPendingFreeItineraryDay,
} from '@/lib/register-pre-photo-verify'
import { collectRouteTextOrderedLandmarkKeywords } from '@/lib/register-schedule-route-text-image-keyword-ssot'
import {
  REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK,
  REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK,
} from '@/lib/register-schedule-image-keyword-prompt'
import {
  isRegisterScheduleFreeLeisureDay,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  isScheduleDomesticHubOnlyRouteText,
  resolveScheduleKeywordSlotKind,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import {
  applyRegisterScheduleImageKeywordsBySupplier,
  type RegisterScheduleImageKeywordApplyRow,
} from '@/lib/register-schedule-image-keywords-apply'

export type ScheduleImageKeywordGeminiRow = RegisterScheduleImageKeywordApplyRow

const GEMINI_FILL_TIMEOUT_MS = Math.max(
  12_000,
  Number(process.env.REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI_TIMEOUT_MS) || 22_000,
)

function buildScheduleRowHaystack(row: ScheduleImageKeywordGeminiRow): string {
  return [row.title, row.description, row.routeText]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

export type RegisterFreeDayDurationLabel = '반나절' | '1day'

const FREE_DAY_CITY_NOISE_RE = /(?:호텔|리조트|숙박|Hotel|Resort|공항|Airport|인천|김포|출발|귀국|체크인|체크아웃)/i

function cityFromPlaceSegment(raw: string): string {
  const s = String(raw ?? '').trim()
  if (s.length < 2) return ''
  if (isHotelLodgingImageKeyword(s) || FREE_DAY_CITY_NOISE_RE.test(s)) return ''
  const mapped = String(mapDestination(s) ?? '').trim()
  if (mapped) return mapped
  if (/[\uAC00-\uD7AF]/.test(s) && s.length <= 16) return s
  return ''
}

function visitCityFromScheduleRow(row: ScheduleImageKeywordGeminiRow, fromEnd: boolean): string {
  const segs = splitRouteTextPlaceSegments(row.routeText)
  const ordered = fromEnd ? [...segs].reverse() : segs
  for (const seg of ordered) {
    const city = cityFromPlaceSegment(seg)
    if (city) return city
  }
  const titleBare = String(row.title ?? '')
    .replace(/일차|추천일정|자유일정|반나절|1\s*day|1일/gi, '')
    .trim()
  return cityFromPlaceSegment(titleBare)
}

/** 자유일정 빈 날 — 제목·dest·인접일 동선에서 머무는 도시 */
// REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 기본 도시 파악 — manifest
export function inferRegisterFreeDayStayCity(args: {
  row: ScheduleImageKeywordGeminiRow
  rows: readonly ScheduleImageKeywordGeminiRow[]
  productDestination?: string | null
  productTitle?: string | null
}): string {
  const own = visitCityFromScheduleRow(args.row, true)
  if (own) return own
  const day = Number(args.row.day)
  const prev = [...args.rows]
    .filter((r) => Number(r.day) > 0 && Number(r.day) < day)
    .sort((a, b) => Number(b.day) - Number(a.day))
  for (const p of prev) {
    const city = visitCityFromScheduleRow(p, true)
    if (city) return city
  }
  const next = [...args.rows]
    .filter((r) => Number(r.day) > day)
    .sort((a, b) => Number(a.day) - Number(b.day))
  for (const n of next) {
    const city = visitCityFromScheduleRow(n, false)
    if (city) return city
  }
  const fromTitle = inferRegisterPendingDestinationFromTitle(args.productTitle ?? '')
  if (fromTitle) return fromTitle
  const destLine = String(args.productDestination ?? '').split('\n')[0]?.trim() ?? ''
  if (isRegisterPrePhotoPlaceLikeDestination(destLine)) {
    return inferRegisterPendingDestinationFromTitle(destLine) || destLine.split(/[·|/]/)[0]!.trim().slice(0, 24)
  }
  return destLine.slice(0, 24) || 'unknown'
}

/** 제목·일차에 반나절이면 반나절, 아니면 1day */
// REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 반나절·1day — manifest
export function inferRegisterFreeDayDurationLabel(
  productTitle: string | null | undefined,
  row: ScheduleImageKeywordGeminiRow,
): RegisterFreeDayDurationLabel {
  const dayHay = [row.title, row.description].join('\n')
  if (/반나절|half[-\s]?day/i.test(dayHay)) return '반나절'
  if (/1\s*day|1일\s*자유|자유\s*1일|종일|풀데이|full[-\s]?day/i.test(dayHay)) return '1day'
  const product = String(productTitle ?? '')
  if (/반나절|half[-\s]?day/i.test(product)) return '반나절'
  return '1day'
}

export function registerFreeDayRecommendedTitle(duration: RegisterFreeDayDurationLabel): string {
  return duration === '반나절' ? '추천일정 반나절' : '추천일정 1day'
}

export function groupRegisterFreeLeisureDaysByStayCity(
  rows: readonly ScheduleImageKeywordGeminiRow[],
  daysToFill: readonly number[],
  opts: { productDestination?: string | null; productTitle?: string | null },
): Array<{ day: number; stayCity: string; duration: RegisterFreeDayDurationLabel }> {
  const byDay = new Map(rows.map((r) => [Number(r.day), r]))
  return daysToFill.map((day) => {
    const row = byDay.get(day) ?? { day }
    return {
      day,
      stayCity: inferRegisterFreeDayStayCity({
        row,
        rows,
        productDestination: opts.productDestination,
        productTitle: opts.productTitle,
      }),
      duration: inferRegisterFreeDayDurationLabel(opts.productTitle, row),
    }
  })
}

function freeDayRouteHasLandmarks(row: ScheduleImageKeywordGeminiRow): boolean {
  return (
    collectRouteTextOrderedLandmarkKeywords(row.routeText).length > 0 ||
    collectRouteTextOrderedLandmarkKeywords(row.description).length > 0
  )
}

/** 패키지 — 제목에 자유일정이 있는 빈 중간일만. FIT·환승·이동은 대상이 아니다. */
// REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — manifest
export function scheduleFreeLeisureDaysMissingImageKeyword(
  rows: readonly ScheduleImageKeywordGeminiRow[],
  productTitle?: string | null,
): number[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const activeDays = sorted.length
  const out: number[] = []
  for (const row of sorted) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot !== 'middle') continue
    if (!isRegisterPendingFreeItineraryDay(row, { productTitle })) continue
    if (
      hasRegisterFreeDayRecommendedItinerary(row) &&
      String(row.imageKeyword ?? '').trim()
    ) {
      continue
    }
    out.push(day)
  }
  return out
}

/** 규칙 적용 후 imageKeyword가 비었지만 일정 텍스트는 있는 일차 */
export function scheduleDaysMissingImageKeywordAfterRules(
  rows: readonly ScheduleImageKeywordGeminiRow[],
  productTitle?: string | null,
): number[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const out: number[] = []
  for (const row of sorted) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    if (String(row.imageKeyword ?? '').trim()) continue
    const hay = buildScheduleRowHaystack(row)
    if (!hay.trim()) continue
    if (isRegisterPendingFreeItineraryDay(row, { productTitle })) continue
    if (isRegisterScheduleFreeLeisureDay(hay)) continue
    const routeText = String(row.routeText ?? '').trim()
    if (!routeText) continue
    /** 출발·귀국 인천-only 등 — 규칙이 의도적으로 비운 슬롯. Gemini가 타일 관광명으로 채우면 SSOT 붕괴 */
    // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: domestic-hub-only·movement·return — Gemini skip
    if (isScheduleDomesticHubOnlyRouteText(routeText, isModetourDomesticHubToken)) continue
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, hay)
    if (dayKind === 'movement' || dayKind === 'return_home') continue
    out.push(day)
  }
  return out
}

function countForeignRouteTextSegments(routeText: string | null | undefined): number {
  return splitRouteTextPlaceSegments(routeText)
    .map((s) => String(s ?? '').trim())
    .filter((s) => s.length >= 2 && !isModetourDomesticHubToken(s)).length
}

/**
 * 관광 일차 — kw1은 있는데 kw2만 비었고 routeText에 2+ 해외 세그먼트(사전 미매핑 포함).
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: manifest
 */
export function scheduleDaysMissingImageKeyword2AfterRules(
  rows: readonly ScheduleImageKeywordGeminiRow[],
): number[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const out: number[] = []
  for (const row of sorted) {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) continue
    if (!String(row.imageKeyword ?? '').trim()) continue
    if (String(row.imageKeyword2 ?? '').trim()) continue
    if (!String(row.routeText ?? '').trim()) continue
    if (countForeignRouteTextSegments(row.routeText) < 2) continue
    const haystack = [row.title, row.description, row.routeText].filter(Boolean).join('\n')
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'tourism') continue
    out.push(day)
  }
  return out
}

export function buildScheduleImageKeywordGeminiPrompt(
  rows: readonly ScheduleImageKeywordGeminiRow[],
  opts: {
    productDestination?: string | null
    productTitle?: string | null
    daysToFill: readonly number[]
  },
): string {
  const daySet = new Set(opts.daysToFill)
  const lines = [...rows]
    .filter((r) => daySet.has(Number(r.day)))
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((r) => {
      const rt = String(r.routeText ?? '').trim() || '(none)'
      const title = String(r.title ?? '').trim()
      const desc = String(r.description ?? '').trim().slice(0, 240)
      return `- Day ${r.day}: routeText="${rt}"${title ? ` title="${title}"` : ''}${desc ? ` description="${desc}"` : ''}`
    })

  return `Fill Pexels English landmark keywords for a package tour schedule.

Product title: ${opts.productTitle?.trim() || 'unknown'}
Destination: ${opts.productDestination?.trim() || 'unknown'}

${REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK}

${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}

Read each day's routeText segments in visit order (A - B - C - D). For each segment, resolve the standard English proper name — do not translate literally.

Days to fill:
${lines.join('\n')}

Return JSON only:
{"schedule":[{"day":1,"imageKeyword":"First landmark EN","imageKeyword2":null}]}

imageKeyword2 must be a second distinct landmark on tourism days when routeText lists 2+ spots; null on departure/return flight days.`
}

export function buildFreeLeisureDayGeminiPrompt(
  rows: readonly ScheduleImageKeywordGeminiRow[],
  opts: {
    productDestination?: string | null
    productTitle?: string | null
    daysToFill: readonly number[]
  },
): string {
  const grouped = groupRegisterFreeLeisureDaysByStayCity(rows, opts.daysToFill, opts)
  const cityCounts = new Map<string, number>()
  for (const g of grouped) {
    cityCounts.set(g.stayCity, (cityCounts.get(g.stayCity) ?? 0) + 1)
  }
  const cityLines = [...cityCounts.entries()].map(
    ([city, n]) => `- ${city}: ${n} empty free day(s) → generate ${n} DISTINCT recommended itineraries`,
  )
  const daySet = new Set(opts.daysToFill)
  const byDayMeta = new Map(grouped.map((g) => [g.day, g]))
  const lines = [...rows]
    .filter((r) => daySet.has(Number(r.day)))
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((r) => {
      const meta = byDayMeta.get(Number(r.day))
      const rt = String(r.routeText ?? '').trim() || '(none)'
      const title = String(r.title ?? '').trim()
      const desc = String(r.description ?? '').trim().slice(0, 320)
      return `- Day ${r.day}: stayCity="${meta?.stayCity ?? 'unknown'}" duration="${meta?.duration ?? '1day'}" title="${title || '(none)'}" routeText="${rt}"${desc ? ` description="${desc}"` : ''}`
    })

  return `This package tour has empty free-leisure day(s). Do not leave them blank.

For each stay city, generate as many DISTINCT recommended itineraries as there are empty days in that city. Do not repeat the same landmarks across days in the same city.

Duration:
- 반나절 / half-day: 2 landmark stops
- 1day: 3-4 landmark stops

Write recommendedRoute as Korean place names in visit order joined by " - ".
Write title as "추천일정 반나절" or "추천일정 1day".
imageKeyword / imageKeyword2 must be English Pexels proper names from THAT recommendedRoute (not literal translations).

Product title: ${opts.productTitle?.trim() || 'unknown'}
Destination: ${opts.productDestination?.trim() || 'unknown'}

Empty days per city:
${cityLines.join('\n')}

${REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK}

${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}

Free-leisure days to fill:
${lines.join('\n')}

Return JSON only:
{"schedule":[{"day":6,"stayCity":"Abu Dhabi","duration":"1day","title":"추천일정 1day","recommendedRoute":"야스아일랜드 - 페라리 월드 - 씨월드","imageKeyword":"Ferrari World","imageKeyword2":"SeaWorld Abu Dhabi"}]}`
}

export type GeminiFreeLeisureDayFill = {
  kw: string
  kw2: string | null
  recommendedRoute: string
  title: string
  duration: RegisterFreeDayDurationLabel | ''
  stayCity: string
}

function parseFreeDayDuration(raw: unknown): RegisterFreeDayDurationLabel | '' {
  const t = String(raw ?? '').trim()
  if (/반나절|half/i.test(t)) return '반나절'
  if (/1day|1일|full|종일/i.test(t)) return '1day'
  return ''
}

/** 제미나이 추천일정을 제목·동선에 쓰고, 그 동선에서 키워드를 맞춘다. */
// REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: recommendedRoute persist — manifest
export function mergeGeminiFreeLeisureRecommendedItinerary<
  T extends RegisterScheduleImageKeywordApplyRow,
>(
  rows: T[],
  byDay: ReadonlyMap<number, GeminiFreeLeisureDayFill>,
  opts: { productTitle?: string | null },
): T[] {
  return rows.map((row) => {
    const day = Number(row.day)
    const g = byDay.get(day)
    if (!g) return row
    const duration =
      g.duration || inferRegisterFreeDayDurationLabel(opts.productTitle, row)
    const recommendedTitle = registerFreeDayRecommendedTitle(duration)
    const keepRoute = freeDayRouteHasLandmarks(row)
    const nextRoute = keepRoute
      ? row.routeText
      : g.recommendedRoute.trim() || row.routeText
    const city =
      g.stayCity.trim() ||
      inferRegisterFreeDayStayCity({
        row,
        rows,
        productTitle: opts.productTitle,
      })
    const routeLabel = String(nextRoute ?? '').trim()
    const description = routeLabel
      ? `${city} 자유일정 추천. ${routeLabel}를 둘러봅니다.`
      : String(row.description ?? '')
    return {
      ...row,
      title: recommendedTitle,
      routeText: nextRoute,
      description,
      imageKeyword: String(row.imageKeyword ?? '').trim() || g.kw,
      imageKeyword2: String(row.imageKeyword2 ?? '').trim() || g.kw2,
    }
  })
}

async function fillFreeLeisureDaysWithGemini<
  T extends RegisterScheduleImageKeywordApplyRow,
>(
  rows: T[],
  opts: {
    supplierKey: string
    productDestination?: string | null
    productTitle?: string | null
    logLabel?: string
  },
): Promise<T[]> {
  const daysToFill = scheduleFreeLeisureDaysMissingImageKeyword(rows, opts.productTitle)
  if (!daysToFill.length) return rows

  const logLabel = opts.logLabel ?? 'register-schedule-free-leisure-gemini'
  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: getModelName() })
    const prompt = buildFreeLeisureDayGeminiPrompt(rows, {
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
      daysToFill,
    })
    const result = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      geminiTimeoutOpts(GEMINI_FILL_TIMEOUT_MS),
    )
    const text = result.response.text()
    const parsed = parseLlmJsonObject<{ schedule?: unknown }>(text, { logLabel })
    const byDay = parseGeminiFreeLeisureRows(parsed.schedule)
    if (!byDay.size) return rows

    const merged = mergeGeminiFreeLeisureRecommendedItinerary(rows, byDay, {
      productTitle: opts.productTitle,
    })

    const applied = applyRegisterScheduleImageKeywordsBySupplier<T>(merged, {
      supplierKey: opts.supplierKey,
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
    })
    return applied.map((row) => {
      const g = byDay.get(Number(row.day))
      if (!g) return row
      const kw = String(row.imageKeyword ?? '').trim()
      const kw2 = String(row.imageKeyword2 ?? '').trim()
      return {
        ...row,
        imageKeyword: kw || g.kw,
        imageKeyword2: kw2 || g.kw2,
      }
    })
  } catch (e) {
    console.warn(`[${logLabel}] free-leisure gemini fill failed`, e)
    return rows
  }
}

export function parseGeminiFreeLeisureRows(raw: unknown): Map<number, GeminiFreeLeisureDayFill> {
  const out = new Map<number, GeminiFreeLeisureDayFill>()
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const day = Number(o.day)
    if (!Number.isFinite(day) || day < 1) continue
    const kw = String(o.imageKeyword ?? '').trim()
    const kw2raw = o.imageKeyword2
    const kw2 =
      kw2raw == null || String(kw2raw).trim() === '' ? null : String(kw2raw).trim()
    const recommendedRoute = String(o.recommendedRoute ?? '').trim()
    const title = String(o.title ?? '').trim()
    if (!kw && !kw2 && !recommendedRoute) continue
    out.set(day, {
      kw,
      kw2,
      recommendedRoute,
      title,
      duration: parseFreeDayDuration(o.duration) || parseFreeDayDuration(title),
      stayCity: String(o.stayCity ?? '').trim(),
    })
  }
  return out
}

function parseGeminiScheduleKeywordRows(raw: unknown): Map<number, { kw: string; kw2: string | null }> {
  const out = new Map<number, { kw: string; kw2: string | null }>()
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const day = Number(o.day)
    if (!Number.isFinite(day) || day < 1) continue
    const kw = String(o.imageKeyword ?? '').trim()
    const kw2raw = o.imageKeyword2
    const kw2 =
      kw2raw == null || String(kw2raw).trim() === '' ? null : String(kw2raw).trim()
    if (!kw && !kw2) continue
    out.set(day, { kw, kw2 })
  }
  return out
}

/**
 * 규칙 후 빈 imageKeyword 일차만 Gemini로 채운 뒤 공급사 규칙을 다시 적용(검증·reconcile).
 */
export async function fillRegisterScheduleImageKeywordsWithGeminiIfNeeded<
  T extends RegisterScheduleImageKeywordApplyRow,
>(
  rows: T[],
  opts: {
    supplierKey: string
    productDestination?: string | null
    productTitle?: string | null
    logLabel?: string
  },
): Promise<T[]> {
  if (!rows.length) return rows
  if (process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI === '1') return rows

  // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: primary-only — kw2는 규칙 SSOT, Gemini 지연 방지 — manifest
  // REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 추천일정 먼저, 관광 빈칸은 그다음 — manifest
  const afterFree = await fillFreeLeisureDaysWithGemini(rows, opts)
  const daysToFill = scheduleDaysMissingImageKeywordAfterRules(afterFree, opts.productTitle)
  if (!daysToFill.length) return afterFree

  const logLabel = opts.logLabel ?? 'register-schedule-image-keyword-gemini'
  try {
    const genAI = getGenAI()
    const model = genAI.getGenerativeModel({ model: getModelName() })
    const prompt = buildScheduleImageKeywordGeminiPrompt(afterFree, {
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
      daysToFill,
    })
    const result = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
      geminiTimeoutOpts(GEMINI_FILL_TIMEOUT_MS),
    )
    const text = result.response.text()
    const parsed = parseLlmJsonObject<{ schedule?: unknown }>(text, { logLabel })
    const byDay = parseGeminiScheduleKeywordRows(parsed.schedule)
    if (!byDay.size) return afterFree

    const merged = afterFree.map((row) => {
      const day = Number(row.day)
      const g = byDay.get(day)
      if (!g) return row
      const existingKw = String(row.imageKeyword ?? '').trim()
      const existingKw2 = String(row.imageKeyword2 ?? '').trim()
      return {
        ...row,
        imageKeyword: existingKw || g.kw,
        imageKeyword2: existingKw2 || g.kw2,
      }
    })

    return applyRegisterScheduleImageKeywordsBySupplier<T>(merged, {
      supplierKey: opts.supplierKey,
      productDestination: opts.productDestination ?? null,
      productTitle: opts.productTitle ?? null,
    })
  } catch (e) {
    console.warn(`[${logLabel}] gemini fill failed`, e)
    return afterFree
  }
}
