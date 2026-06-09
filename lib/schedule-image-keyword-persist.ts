/**
 * Product.schedule[].imageKeyword — 관리자·API 저장 경로 SSOT.
 * 등록 파이프라인은 `finalizeScheduleImageKeyword` 직접 사용.
 */
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'

/** process-images 추적용 — Pexels 장소명 가드 대상 아님 */
const OPERATIONAL_SCHEDULE_KEY_RE = /^(?:day_\d+|premade_\d+)$/i

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

/** process-images·DB 저장 시 hero가 덮어쓰면 안 되는 운영용 키 */
export function isOperationalScheduleImageKeyword(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return false
  return OPERATIONAL_SCHEDULE_KEY_RE.test(t) || DAY_N_TRAVEL_RE.test(t)
}

/** 일차별 랜드마크 imageKeyword가 2개 이상 서로 다른지(풀 일괄 배정 스킵·Fit SSOT 판별) */
export function areScheduleImageKeywordsDistinct(
  rows: Array<{ imageKeyword?: string | null }>,
  minDistinct = 2,
): boolean {
  const kws = rows
    .map((r) => String(r.imageKeyword ?? '').trim())
    .filter((k) => k.length > 0 && !isOperationalScheduleImageKeyword(k))
  if (kws.length < minDistinct) return false
  return new Set(kws.map((k) => k.toLowerCase())).size >= minDistinct
}

/** 일정 SSOT 키워드 우선 — hero 검색 라벨은 보조 */
export function resolveScheduleImageKeywordForDb(
  stored: string | null | undefined,
  heroUsed: string | null | undefined,
  dayFallback: string,
): string {
  const storedTrim = String(stored ?? '').trim()
  if (storedTrim && !isOperationalScheduleImageKeyword(storedTrim)) return storedTrim
  const heroTrim = String(heroUsed ?? '').trim()
  if (heroTrim && !isOperationalScheduleImageKeyword(heroTrim)) return heroTrim
  return storedTrim || heroTrim || dayFallback
}

export class ScheduleImageKeywordPersistError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduleImageKeywordPersistError'
  }
}

/**
 * DB/API에 쓸 imageKeyword. 빈 입력·Day N travel → ''.
 * operational 키(`day_3`, `premade_1`)는 길이만 자른다.
 */
export function persistScheduleImageKeyword(
  raw: string | null | undefined,
  maxLen = 500,
): string {
  const trimmed = String(raw ?? '').trim().slice(0, maxLen)
  if (!trimmed) return ''
  if (OPERATIONAL_SCHEDULE_KEY_RE.test(trimmed)) return trimmed
  if (DAY_N_TRAVEL_RE.test(trimmed)) return ''
  try {
    return finalizeScheduleImageKeyword(trimmed).slice(0, maxLen)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ScheduleImageKeywordPersistError(msg)
  }
}

export type PersistScheduleImageKeywordResult =
  | { ok: true; value: string }
  | { ok: false; error: string }

/** UI·confirm — 실패 시 메시지 반환(API는 throw 버전 사용). */
export function tryPersistScheduleImageKeyword(
  raw: string | null | undefined,
  maxLen = 500,
): PersistScheduleImageKeywordResult {
  try {
    return { ok: true, value: persistScheduleImageKeyword(raw, maxLen) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export type ScheduleImageFieldsInput = {
  imageKeyword?: string | null
  imageKeyword2?: string | null
  imagePlaceName?: string | null
  imageRehostSearchLabel?: string | null
}

/** schedule 행 imageKeyword·imagePlaceName·imageRehostSearchLabel — persist 후 SSOT 통일 */
export function persistScheduleImageFields<T extends ScheduleImageFieldsInput>(
  row: T,
  maxLen = 500,
): T {
  const kw = persistScheduleImageKeyword(row.imageKeyword, maxLen)
  const kw2 =
    row.imageKeyword2 != null && String(row.imageKeyword2).trim()
      ? persistScheduleImageKeyword(row.imageKeyword2, maxLen)
      : ''
  let place =
    row.imagePlaceName != null && String(row.imagePlaceName).trim()
      ? persistScheduleImageKeyword(row.imagePlaceName, maxLen)
      : ''
  let label =
    row.imageRehostSearchLabel != null && String(row.imageRehostSearchLabel).trim()
      ? persistScheduleImageKeyword(row.imageRehostSearchLabel, maxLen)
      : ''
  if (kw) {
    if (place && place !== kw) place = kw
    if (label && label !== kw) label = kw
  }
  return {
    ...row,
    imageKeyword: kw,
    imageKeyword2: kw2 || null,
    imagePlaceName: place || null,
    imageRehostSearchLabel: label || null,
  }
}

/** @deprecated `persistScheduleImageFields` 사용 */
export const finalizeScheduleImageSeoFields = persistScheduleImageFields

export type ProductScheduleJsonRow = ScheduleImageFieldsInput & {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
}

type ProductScheduleFinalizeInput = ScheduleImageFieldsInput & {
  day: number
  title: string
  description: string
  routeText: string | null
  imageUrl: string | null
  imageUrl2: string | null
}

/**
 * Product.schedule JSON — 등록 확정·동기화 공통.
 * `finalizeRegisterScheduleImageKeywords` 적용 후 imageKeyword·imageKeyword2 포함.
 */
export function buildProductScheduleJsonForDb(
  schedule: ProductScheduleJsonRow[],
  mapExtra?: (row: ProductScheduleJsonRow) => Record<string, unknown>,
): string {
  const inputs: ProductScheduleFinalizeInput[] = schedule.map((row) => ({
    day: row.day,
    title: String(row.title ?? '').trim(),
    description: String(row.description ?? '').trim(),
    routeText: row.routeText ?? null,
    imageKeyword: String(row.imageKeyword ?? '').trim(),
    imageKeyword2: row.imageKeyword2 ?? null,
    imageUrl: row.imageUrl ?? null,
    imageUrl2: row.imageUrl2 ?? null,
  }))
  const finalized = finalizeRegisterScheduleImageKeywords(inputs)
  return JSON.stringify(
    finalized.map((row, i) => {
      const extra = mapExtra?.(schedule[i]!) ?? {}
      return {
        day: row.day,
        title: row.title,
        description: row.description,
        routeText: row.routeText ?? null,
        imageKeyword: row.imageKeyword,
        imageKeyword2: row.imageKeyword2 ?? null,
        imageUrl: inputs[i]!.imageUrl,
        imageUrl2: inputs[i]!.imageUrl2,
        ...extra,
      }
    }),
  )
}

/** confirm 일괄 처리 — imageKeyword·imageKeyword2 persist */
export function finalizeRegisterScheduleImageKeywords<
  T extends ScheduleImageFieldsInput & { day: number; title?: string; description?: string; routeText?: string | null },
>(schedule: T[], _opts?: { productDestination?: string | null }): T[] {
  return schedule.map((row) => {
    const day = Number(row.day)
    try {
      return persistScheduleImageFields({
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new ScheduleImageKeywordPersistError(`Day ${day}: ${msg}`)
    }
  })
}
