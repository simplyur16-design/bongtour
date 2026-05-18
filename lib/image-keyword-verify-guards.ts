/**
 * imageKeyword / Pexels query 검증 스크립트·저장 직전 가드 공통 — 금지 보조어 탐지.
 */

/** 가드·검증 스크립트 단일 출처 — 삼단 segment·Pexels 보조어 substring */
export const BANNED_KEYWORD_PATTERNS = [
  ' / landmark',
  ' / exterior',
  ' / interior',
  ' / street-level',
  ' / aerial',
  ' / skyline',
  ' / night view',
  ' landmark exterior',
  ' street-level view',
  ' skyline',
  ' eye-level view',
  ' frontal view',
  ' close view',
  ' wide view',
  ' facade and',
  ' ornate shrine',
  ' architectural detail',
  ' night tour',
  ' night',
  ' aerial view',
  ' aerial',
] as const

/**
 * 금지 패턴(`night` 등)에 걸려도 **실제 장소명**으로 허용하는 구문.
 * `detectBannedSuffix`는 금지 매치가 허용 구문 안에 있으면 무시한다.
 */
export const ALLOWED_KEYWORD_PATTERNS = ['night market'] as const

/** 허용 구문을 공백으로 덮어 금지 패턴 탐지에서 제외 */
function scrubAllowedPhrases(lowered: string): string {
  let s = lowered
  for (const allowed of ALLOWED_KEYWORD_PATTERNS) {
    const re = new RegExp(escapeRegExp(allowed.toLowerCase()), 'gi')
    s = s.replace(re, (m) => ' '.repeat(m.length))
  }
  return s
}

/**
 * 저장·검증 공통 — 보조어 패턴이 포함되면 해당 패턴 문자열 반환.
 */
export function detectBannedSuffix(keyword: string): string | null {
  if (!keyword.trim()) return null
  const scrubbed = scrubAllowedPhrases(keyword.toLowerCase())
  for (const pattern of BANNED_KEYWORD_PATTERNS) {
    if (scrubbed.includes(pattern.toLowerCase())) {
      return pattern
    }
  }
  return null
}

/** @deprecated 검증용 별칭 — `detectBannedSuffix` 단일 출처 사용 권장 */
export const IMAGE_KEYWORD_AUXILIARY_TERMS = BANNED_KEYWORD_PATTERNS

/** DB 검증 스크립트용 — 매칭된 패턴 목록 */
export function findImageKeywordBannedHits(keyword: string): string[] {
  const hit = detectBannedSuffix(keyword)
  return hit ? [hit] : []
}

/** Pexels API `query` 문자열에 있으면 안 되는 보조어 */
export const PEXELS_QUERY_BANNED_TERMS = [
  'travel',
  'landscape',
  'photorealistic',
  'landmark',
  'attraction',
] as const

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 하이픈 포함은 부분 문자열, 그 외는 단어 경계 */
function termMatches(text: string, term: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (term.includes('-')) return t.toLowerCase().includes(term.toLowerCase())
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(t)
}

export function findBannedTerms(text: string, terms: readonly string[]): string[] {
  if (!text.trim()) return []
  return terms.filter((term) => termMatches(text, term))
}

export type ScheduleKeywordRow = { day: number; imageKeyword: string }

/** schedule JSON 일차별 검증·백필 대상 필드 */
export const SCHEDULE_IMAGE_GUARD_FIELD_NAMES = [
  'imageKeyword',
  'imagePlaceName',
  'imageRehostSearchLabel',
] as const

export type ScheduleImageGuardFieldName = (typeof SCHEDULE_IMAGE_GUARD_FIELD_NAMES)[number]

export type ScheduleImageFieldRow = {
  day: number
  imageKeyword: string
  imagePlaceName: string
  imageRehostSearchLabel: string
}

/** ` / ` 삼단 또는 보조어 패턴 — 백필·검증 공통 */
export function needsScheduleImageFieldBackfill(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  if (t.includes(' / ')) return true
  return detectBannedSuffix(t) !== null
}

export function parseScheduleImageFields(
  scheduleJson: string | null | undefined,
): ScheduleImageFieldRow[] {
  if (!scheduleJson?.trim()) return []
  try {
    const arr = JSON.parse(scheduleJson) as unknown
    if (!Array.isArray(arr)) return []
    const out: ScheduleImageFieldRow[] = []
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const day = Number(o.day)
      if (!Number.isFinite(day) || day < 1) continue
      out.push({
        day,
        imageKeyword: String(o.imageKeyword ?? '').trim(),
        imagePlaceName: String(o.imagePlaceName ?? '').trim(),
        imageRehostSearchLabel: String(o.imageRehostSearchLabel ?? '').trim(),
      })
    }
    return out.sort((a, b) => a.day - b.day)
  } catch {
    return []
  }
}

export function parseScheduleImageKeywords(scheduleJson: string | null | undefined): ScheduleKeywordRow[] {
  if (!scheduleJson?.trim()) return []
  try {
    const arr = JSON.parse(scheduleJson) as unknown
    if (!Array.isArray(arr)) return []
    const out: ScheduleKeywordRow[] = []
    for (const item of arr) {
      const o = item as Record<string, unknown>
      const day = Number(o.day)
      if (!Number.isFinite(day) || day < 1) continue
      const imageKeyword = String(o.imageKeyword ?? '').trim()
      out.push({ day, imageKeyword })
    }
    return out.sort((a, b) => a.day - b.day)
  } catch {
    return []
  }
}
