/**
 * 상품 대표 이미지(bgImageUrl) 검색어 — 일정 원문 규칙으로 고른 핵심 방문지 1개.
 *
 * REGRESSION-FREEZE[hero-keyword-rules-1128]: 사장님 11/28 07:56 '대표사진 검색어는 Gemini 빼고 일정 원문 규칙으로 만들어'.
 * Gemini·LLM 호출 없음. 각 일차의 imageKeyword(그날 장소만, PR180/181)와 그날 원문(제목·routeText·설명)에서
 * schedule-poi-regex-ssot 사전으로 찾은 장소만 후보(photo-autofill-sight deriveDaySights 재사용). 도시·나라 이름만인 검색어는 쓰지 않는다(빈 문자열 + 사유). — manifest
 */

import { pickHighestPriorityLandmark } from '@/lib/famous-landmarks-priority'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import { deriveDaySights, foldPhotoText, scheduleRowSupplierText, sightProfile } from '@/lib/photo-autofill-sight'

export type ProductHeroPlaceKeywordSource =
  | 'priority_map'
  | 'most_days'
  | 'first_day'
  | 'cache'
  | 'no_sight'

export type ProductHeroItineraryDayInput = {
  day: number
  imageKeyword: string
  poiNamesRaw?: string
  summaryText?: string
  /** 그날 원문 — deriveDaySights(그날 장소만) 입력 */
  title?: string
  routeText?: string
  description?: string
  supplierText?: string
  imageKeyword2?: string
}

export type SelectProductHeroPlaceKeywordInput = {
  productId: string
  itineraryDays: ProductHeroItineraryDayInput[]
  cityEn?: string
  countryEn?: string
  destinationKr?: string
  /** `bgImageRehostSearchLabel` 등에 저장된 영문 장소명 — 일정 후보와 같을 때만 쓴다 */
  cachedHeroPlaceKeyword?: string | null
}

export type SelectProductHeroPlaceKeywordResult = {
  keyword: string
  source: ProductHeroPlaceKeywordSource
  reasoning?: string
  /** 규칙 후보(일차 순) — 로그 증거용 */
  candidates?: string[]
}

type DayCandidate = { day: number; keyword: string; key: string }

/** 도시·나라·일반명사만인 이름은 대표 검색어가 아니다 */
function isSightKeyword(kw: string): boolean {
  if (!kw) return false
  // 'generic'(예: Great Wall of China — 일반 낱말이라 도시 앵커가 필요한 명소)도 명소. city·empty 만 뺀다
  const kind = sightProfile(kw).kind
  return kind === 'sight' || kind === 'generic'
}

function candidateKey(kw: string): string {
  return foldPhotoText(kw)
}

/**
 * 일차별 규칙 후보 — PR180/181 '그날 장소만' 규칙(deriveDaySights) 재사용:
 * 그날 imageKeyword 가 그날 원문에 있는 장소일 때만, 그다음 그날 원문 사전 일치. 다른 일차 장소·도시 이름만은 버린다.
 */
export function heroKeywordCandidatesByDay(days: readonly ProductHeroItineraryDayInput[]): DayCandidate[] {
  const out: DayCandidate[] = []
  const sorted = [...days].sort((a, b) => a.day - b.day)
  const textOf = (d: ProductHeroItineraryDayInput) =>
    [d.title, d.routeText, d.description, d.supplierText, d.poiNamesRaw, d.summaryText].filter(Boolean).join(' ')
  for (const d of sorted) {
    const hasRaw = Boolean(d.title || d.routeText || d.description || d.supplierText)
    const { sights } = deriveDaySights({
      title: d.title ?? null,
      routeText: hasRaw ? (d.routeText ?? null) : [d.poiNamesRaw, d.summaryText].filter(Boolean).join(' - ') || null,
      description: d.description ?? null,
      supplierText: d.supplierText ?? null,
      imageKeyword: d.imageKeyword || null,
      imageKeyword2: d.imageKeyword2 ?? null,
      otherDaysText: sorted.filter((o) => o.day !== d.day).map(textOf).join(' '),
    })
    const seenToday = new Set<string>()
    for (const raw of sights) {
      const kw = normalizeToPlaceName(raw) || raw
      if (!isSightKeyword(kw)) continue
      const key = candidateKey(kw)
      if (!key || seenToday.has(key)) continue
      seenToday.add(key)
      out.push({ day: d.day, keyword: kw, key })
    }
  }
  return out
}

/**
 * 상품 대표 이미지 검색 키워드 선정 — 규칙만(Gemini 없음).
 * 1) 유명 관광지 점수표 2) 여러 일차에 나온 장소 3) 가장 앞 일차 장소. 없으면 '' (도시명 대체 금지).
 */
export async function selectProductHeroPlaceKeyword(
  input: SelectProductHeroPlaceKeywordInput,
): Promise<SelectProductHeroPlaceKeywordResult> {
  return selectProductHeroPlaceKeywordSync(input)
}

export function selectProductHeroPlaceKeywordSync(
  input: SelectProductHeroPlaceKeywordInput,
): SelectProductHeroPlaceKeywordResult {
  const cands = heroKeywordCandidatesByDay(input.itineraryDays)
  const candidates = [...new Set(cands.map((c) => c.keyword))]
  if (cands.length === 0) {
    return { keyword: '', source: 'no_sight', reasoning: 'itinerary_has_no_named_sight', candidates }
  }

  const cached = normalizeToPlaceName(input.cachedHeroPlaceKeyword ?? '')
  if (cached && isSightKeyword(cached)) {
    const ck = candidateKey(cached)
    const hit = cands.find((c) => c.key === ck)
    if (hit) return { keyword: hit.keyword, source: 'cache', candidates }
  }

  const priority = pickHighestPriorityLandmark(candidates, (s) => normalizeToPlaceName(s))
  if (priority?.keyword && isSightKeyword(priority.keyword)) {
    return { keyword: priority.keyword, source: 'priority_map', candidates }
  }

  const dayCount = new Map<string, { kw: string; days: Set<number>; first: number }>()
  for (const c of cands) {
    const e = dayCount.get(c.key) ?? { kw: c.keyword, days: new Set<number>(), first: c.day }
    e.days.add(c.day)
    dayCount.set(c.key, e)
  }
  const multi = [...dayCount.values()].filter((e) => e.days.size >= 2).sort((a, b) => b.days.size - a.days.size || a.first - b.first)
  if (multi[0]) return { keyword: multi[0].kw, source: 'most_days', candidates }

  return { keyword: cands[0]!.keyword, source: 'first_day', candidates }
}

/** schedule JSON + itinerary rows → 선정 입력 */
export function buildHeroKeywordInputsFromSchedule(
  scheduleJson: string | null | undefined,
  itineraryRows?: Array<{ day: number; poiNamesRaw?: string | null; summaryTextRaw?: string | null }>,
): ProductHeroItineraryDayInput[] {
  const byDay = new Map<number, ProductHeroItineraryDayInput>()
  if (scheduleJson?.trim()) {
    try {
      const arr = JSON.parse(scheduleJson) as unknown
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const o = item as Record<string, unknown>
          const day = Number(o.day)
          if (!Number.isFinite(day) || day < 1) continue
          byDay.set(day, {
            day,
            imageKeyword: String(o.imageKeyword ?? '').trim(),
            imageKeyword2: typeof o.imageKeyword2 === 'string' ? o.imageKeyword2.trim() : undefined,
            title: typeof o.title === 'string' ? o.title : undefined,
            routeText: typeof o.routeText === 'string' ? o.routeText : undefined,
            description: typeof o.description === 'string' ? o.description : undefined,
            supplierText: scheduleRowSupplierText(o) || undefined,
          })
        }
      }
    } catch {
      /* ignore */
    }
  }
  for (const row of itineraryRows ?? []) {
    const prev = byDay.get(row.day)
    byDay.set(row.day, {
      day: row.day,
      imageKeyword: prev?.imageKeyword ?? '',
      imageKeyword2: prev?.imageKeyword2,
      title: prev?.title,
      routeText: prev?.routeText,
      description: prev?.description,
      supplierText: prev?.supplierText,
      poiNamesRaw: row.poiNamesRaw ?? undefined,
      summaryText: row.summaryTextRaw ?? undefined,
    })
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}
