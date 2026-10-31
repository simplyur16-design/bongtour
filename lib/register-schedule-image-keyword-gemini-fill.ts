/**
 * routeText 규칙·POI 사전 후에도 imageKeyword가 비는 일차 — Gemini로 영문 랜드마크 1·2순위 생성.
 * 자유일정 일차 — 도시·반나절/1day를 파악한 뒤 제미나이 추천일정을 일정에 쓰고 키워드를 맞춘다.
 * REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: manifest
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — FIT·환승 제외 — manifest
 */
import { BONGTOUR_FREE_DAY_VOICE_BLOCK } from '@/lib/bongtour-free-day-voice-block'
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
  REGISTER_DAY_FREE_TIME_TITLE_RE,
  REGISTER_FREE_ITINERARY_TITLE_RE,
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

const FREE_DAY_TITLE_PREFIX_RE = /^추천일정\s*(?:1\s*day|반나절)?\s*(?:·\s*)?/iu

function freeDayTitlePlaceOk(seg: string, city: string, titleTokens?: ReadonlySet<string>): boolean {
  const t = seg.trim()
  if (t.length < 2) return false
  if (city && t === city.trim()) return false
  // 상품 제목에 낱말로 들어 있는 도시명(예: '오사카/교토/나라 3일'의 오사카)은 장소로 치지 않는다
  if (titleTokens?.has(t)) return false
  if (REGISTER_FREE_ITINERARY_TITLE_RE.test(t) || REGISTER_DAY_FREE_TIME_TITLE_RE.test(t)) return false
  if (/^추천일정/u.test(t)) return false
  return true
}

/**
 * 톤 1031: 자유일정 추천 제목 — '추천일정 1day · 장소·장소' (앞머리는 코드가 추천일정 여부를 판단하는 고정 문구).
 * 제미나이 제목에 장소가 붙어 있으면 그 장소를 쓰고('·' 앞뒤 띄어쓰기만 정리), 없으면 그날 추천 동선 앞 두 곳으로 만든다.
 * (round3 남은 문제: mt-0240 D2 제목이 '추천일정 1day'만 나오던 것)
 */
export function buildRegisterFreeDayRecommendedTitle(args: {
  duration: RegisterFreeDayDurationLabel
  geminiTitle?: string | null
  route?: string | null
  city?: string | null
  productTitle?: string | null
}): string {
  const prefix = registerFreeDayRecommendedTitle(args.duration)
  const city = String(args.city ?? '').trim()
  const titleTokens = new Set(
    String(args.productTitle ?? '')
      .split(/[^\p{L}\p{N}]+/u)
      .map((x) => x.trim())
      .filter(Boolean),
  )
  const gt = String(args.geminiTitle ?? '').trim()
  let places: string[] = []
  if (/^추천일정/u.test(gt)) {
    places = gt
      .replace(FREE_DAY_TITLE_PREFIX_RE, '')
      .split(/\s*·\s*/u)
      .map((x) => x.trim())
      .filter((x) => freeDayTitlePlaceOk(x, city, titleTokens))
  }
  if (!places.length) {
    places = String(args.route ?? '')
      .split(/\s+-\s+/u)
      .map((x) => x.trim())
      .filter((x) => freeDayTitlePlaceOk(x, city, titleTokens))
  }
  places = [...new Set(places)].slice(0, 2)
  return places.length ? `${prefix} · ${places.join('·')}` : prefix
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
    /** 출발·귀국 인천-only 등 — 규칙이 의도적으로 비운 슬롯. Gemini가 타일 관광명으로 채우면 SSOT 붕괴 */
    // REGRESSION-FREEZE[register-schedule-image-keyword-gemini-fill]: domestic-hub-only·movement·return — Gemini skip
    if (routeText && isScheduleDomesticHubOnlyRouteText(routeText, isModetourDomesticHubToken)) continue
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, hay)
    if (dayKind === 'movement' || dayKind === 'return_home') continue
    // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: route 없어도 title/desc hay면 Gemini 대상 — manifest
    if (!routeText) {
      const title = String(row.title ?? '').trim()
      const desc = String(row.description ?? '').trim()
      if (!title && !desc) continue
      // 호텔-only title은 도시 soft-dup·heal 경로 — Gemini 환각 방지
      if (/호텔|리조트|호캉스|Hotel|Resort/i.test(title) && !/\s[-–—→]\s/u.test(title)) continue
    }
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

Write recommendedRoute as Korean place names in visit order joined by " - ". Keep ONE area (zone) per day — do not mix two districts that need a train ride between them.
Write title as "추천일정 반나절 · 장소1·장소2" or "추천일정 1day · 장소1·장소2" — keep the leading "추천일정 반나절/1day" exactly (code uses it), then the day's 1-2 main places joined by "·" with no spaces around that middle dot.
Write summary in Korean, 3-4 sentences in visit order, as a Bongtour travel manager recommending directly to a customer ("저라면 …", "~해 보세요", "~하시면 편해요"). One short reason per place.
Summary/route/places rules:
- No numbers at all (no prices, fees, times, durations, distances, counts). Never invent prices.
- Banned words: 최저가, 무조건, 최고, 유명, 제일, 가장, 빠질 수 없는, 피로가 싹, 인기 있는, 꼭 가야.
- The package hotel address is unknown: never say 숙소 근처 / 호텔 근처 / 숙소와 가까운 / 호텔 바로 옆, or anything about distance to the hotel.
- Do not repeat places already visited on other days. Do not write the product title.
imageKeyword / imageKeyword2 must be English Pexels proper names from THAT recommendedRoute (not literal translations).

Korean voice & fact rules for title/summary (same block as the FIT itinerary prompt):
${BONGTOUR_FREE_DAY_VOICE_BLOCK}

Product title: ${opts.productTitle?.trim() || 'unknown'}
Destination: ${opts.productDestination?.trim() || 'unknown'}

Empty days per city:
${cityLines.join('\n')}

${REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK}

${REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK}

Free-leisure days to fill:
${lines.join('\n')}

Return JSON only:
{"schedule":[{"day":6,"stayCity":"Abu Dhabi","duration":"1day","title":"추천일정 1day · 페라리 월드·씨월드","recommendedRoute":"야스아일랜드 - 페라리 월드 - 씨월드","summary":"저라면 아침에 야스아일랜드로 넘어가 하루를 시작합니다. 페라리 월드에서는 실내라 더위 걱정 없이 놀이기구를 즐기시면 돼요. 오후에는 씨월드로 옮겨 바다 동물 전시를 천천히 구경해 보세요. 두 곳이 같은 섬 안이라 동선이 단순해서 편해요.","imageKeyword":"Ferrari World","imageKeyword2":"SeaWorld Abu Dhabi"}]}`
}

export type GeminiFreeLeisureDayFill = {
  kw: string
  kw2: string | null
  recommendedRoute: string
  title: string
  /** 톤 1031: 제미나이 3~4문장 요약 — 있으면 description 에 그대로(템플릿으로 덮어쓰지 않음) */
  summary: string
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
    const recommendedTitle = buildRegisterFreeDayRecommendedTitle({
      duration,
      geminiTitle: g.title,
      route: routeLabel,
      city,
      productTitle: opts.productTitle,
    })
    // 톤 1031: 제미나이 요약이 있으면 그대로 쓴다. '…를 둘러봅니다' 템플릿은 요약이 없을 때만(옛 응답 호환).
    const geminiSummary = String(g.summary ?? '').replace(/\s+/g, ' ').trim()
    const description = geminiSummary
      ? geminiSummary
      : routeLabel
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
      summary: String(o.summary ?? '').trim(),
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
