/**
 * 일차별 공급사 원문 — Product.schedule[i].supplierOriginal (스키마 변경 없음).
 *
 * 사장님 10/30 19:55 KST: "요약은 3~4문장으로 요약하고 원문별토칸에 넣지만 고객이 클릭해서 보고싶을때만 펼쳐지게하라."
 * - 요약(title/description)은 그대로 두고, 원문은 이 키에만 저장한다.
 * - 저장 위치 근거: 힐(register-pending-pre-photo-self-heal)·레인 재구성·이미지 저장 경로는 일정 행을 `...row`로 펼쳐 쓰므로
 *   모르는 키를 보존한다. ItineraryDay.rawBlock 은 등록 때 매번 {title,description,imageKeyword} JSON으로 덮어써서 부적합.
 * - 결정적 복사만 (LLM·요약·추론 없음).
 */
import { parseFactMealsListToScheduleFields } from '@/lib/register-schedule-meal-parse'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'

export const SCHEDULE_DAY_SUPPLIER_ORIGINAL_KEY = 'supplierOriginal' as const

export type ScheduleDaySupplierOriginalItem = {
  /** 공급사 분류명 그대로(관광·이동 등). 없으면 null */
  label?: string | null
  name?: string | null
  text?: string | null
}

export type ScheduleDaySupplierOriginal = {
  v: 1
  /** hanatour·modetour … */
  source: string
  /** ISO 시각 — 화면에 쓰지 않음 */
  capturedAt?: string | null
  items: ScheduleDaySupplierOriginalItem[]
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\r\n?/g, '\n').trim()
  return t ? t : null
}

/** 저장값 → 타입 (형식이 틀리면 null) */
export function parseScheduleDaySupplierOriginal(raw: unknown): ScheduleDaySupplierOriginal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const itemsRaw = Array.isArray(o.items) ? o.items : []
  const items: ScheduleDaySupplierOriginalItem[] = []
  for (const it of itemsRaw) {
    if (!it || typeof it !== 'object') continue
    const r = it as Record<string, unknown>
    const name = str(r.name)
    const text = str(r.text)
    if (!name && !text) continue
    items.push({ label: str(r.label), name, text })
  }
  const out: ScheduleDaySupplierOriginal = {
    v: 1,
    source: str(o.source) ?? '',
    capturedAt: str(o.capturedAt),
    items,
    hotelText: str(o.hotelText),
    breakfastText: str(o.breakfastText),
    lunchText: str(o.lunchText),
    dinnerText: str(o.dinnerText),
  }
  if (!out.items.length && !out.hotelText && !out.breakfastText && !out.lunchText && !out.dinnerText) return null
  return out
}

/** 등록 수집 fact(일차) → 원문 — 장소·이동·숙소·식사를 받은 그대로 옮김 */
export function buildScheduleDaySupplierOriginalFromFactDay(
  d: RegisterFactScheduleDay,
  source: string,
  capturedAt: string | null = null,
): ScheduleDaySupplierOriginal | null {
  const items: ScheduleDaySupplierOriginalItem[] = []
  for (const seg of String(d.transportNote ?? '').split(';')) {
    const t = seg.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim()
    if (t) items.push({ label: null, name: null, text: t })
  }
  for (const p of d.places ?? []) {
    const t = String(p ?? '').trim()
    if (t) items.push({ label: null, name: t, text: null })
  }
  const hotels = (d.hotels ?? []).map((h) => String(h ?? '').trim()).filter(Boolean)
  const meals = parseFactMealsListToScheduleFields(d.meals ?? [])
  return parseScheduleDaySupplierOriginal({
    v: 1,
    source,
    capturedAt,
    items,
    hotelText: hotels.length ? hotels.join(' / ') : null,
    breakfastText: meals.breakfastText ?? null,
    lunchText: meals.lunchText ?? null,
    dinnerText: meals.dinnerText ?? null,
  })
}

/** 공급사 *FactDaysToRegisterSchedule 결과에 같은 일차 원문을 붙인다 (요약 필드는 건드리지 않음) */
export function attachScheduleDaySupplierOriginalFromFactDays<T extends { day: number }>(
  days: RegisterFactScheduleDay[],
  source: string,
  rows: T[],
): Array<T & { supplierOriginal?: ScheduleDaySupplierOriginal }> {
  const byDay = new Map(days.map((d) => [Number(d.day), d]))
  const capturedAt = new Date().toISOString()
  return rows.map((row) => {
    const d = byDay.get(Number(row.day))
    const orig = d ? buildScheduleDaySupplierOriginalFromFactDay(d, source, capturedAt) : null
    return orig ? { ...row, supplierOriginal: orig } : row
  })
}

export type ScheduleDaySupplierOriginalView = {
  routeLine: string | null
  items: ScheduleDaySupplierOriginalItem[]
  hotelText: string | null
  meals: Array<{ label: '조식' | '중식' | '석식'; value: string }>
}

/** 고객 화면에 쓰면 안 되는 내부 문구 */
const INTERNAL_WORD_RE = /\((?:원문\s*순서)\)|원문\s*미기재|원문\s*순서/g

function scrubInternal(s: string | null | undefined): string | null {
  if (s == null) return null
  const t = s.replace(INTERNAL_WORD_RE, '').replace(/[ \t]+\n/g, '\n').trim()
  return t ? t : null
}

/**
 * 토글 본문 — 문과장 검수: 내부어 금지, 빈 숙소·식사 숨김(null/공백만; 없음·불포함·기내식은 그대로),
 * 조식/중식/석식 라벨, 날짜 계산 없음, 제목과 다른 routeText 표시.
 */
export function buildScheduleDaySupplierOriginalView(day: {
  title?: string | null
  routeText?: string | null
  supplierOriginal?: ScheduleDaySupplierOriginal | null
}): ScheduleDaySupplierOriginalView | null {
  const o = day.supplierOriginal ? parseScheduleDaySupplierOriginal(day.supplierOriginal) : null
  if (!o) return null
  const route = scrubInternal(day.routeText ?? null)
  const title = String(day.title ?? '').trim()
  const items = o.items
    .map((it) => ({ label: scrubInternal(it.label), name: scrubInternal(it.name), text: scrubInternal(it.text) }))
    .filter((it) => it.name || it.text)
  const meals: ScheduleDaySupplierOriginalView['meals'] = []
  const b = scrubInternal(o.breakfastText)
  const l = scrubInternal(o.lunchText)
  const dn = scrubInternal(o.dinnerText)
  if (b) meals.push({ label: '조식', value: b })
  if (l) meals.push({ label: '중식', value: l })
  if (dn) meals.push({ label: '석식', value: dn })
  return {
    routeLine: route && route !== title ? route : null,
    items,
    hotelText: scrubInternal(o.hotelText),
    meals,
  }
}

/** 이어진 같은 장소는 한 번만. 구분은 ` - `. */
export function collapseConsecutiveRouteSegments(route: string): string {
  const parts = route
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (out.length > 0 && out[out.length - 1] === part) continue
    out.push(part)
  }
  return out.join(' - ')
}

/**
 * 일차 제목 아래 경로 한 줄.
 * 공급사 원문 뷰의 routeLine이 있으면 그것을, 없으면 그날 routeText를 쓴다.
 * 공백·제목과 같은 문구는 숨긴다.
 * REGRESSION-FREEZE[itinerary-detail-route-under-title]: 제목 아래 경로 한 줄 — manifest
 */
export function publicDayTitleRouteLine(day: {
  title?: string | null
  routeText?: string | null
  supplierOriginal?: ScheduleDaySupplierOriginal | null
}): string | null {
  const view = buildScheduleDaySupplierOriginalView(day)
  const source = view ? view.routeLine : scrubInternal(day.routeText ?? null)
  if (!source) return null
  const collapsed = collapseConsecutiveRouteSegments(source).trim()
  if (!collapsed) return null
  const title = String(day.title ?? '').trim()
  if (title && collapsed === title) return null
  return collapsed
}

/** 토큰 무결성 검사용 — 원문 측 표시 텍스트 전부 */
export function scheduleDaySupplierOriginalViewText(v: ScheduleDaySupplierOriginalView): string {
  return [
    v.routeLine,
    ...v.items.flatMap((it) => [it.label, it.name, it.text]),
    v.hotelText,
    ...v.meals.flatMap((m) => [m.label, m.value]),
  ]
    .filter(Boolean)
    .join('\n')
}
