/**
 * 등록 confirm — 일정에서 geo·도시 태그 매칭용 텍스트 (메가메뉴 SSOT).
 * 국가 판정은 title·description·routeText. 도시 태그 추가는 제목·장소만 (`buildRegisterCityVisitHaystackFromSchedule`).
 */
import { buildRegisterCityVisitHaystackFromSchedule as buildVisit } from '@/lib/register-city-tag-guard'

const REGISTER_GEO_SCHEDULE_HAYSTACK_MAX = 6000

export type RegisterGeoScheduleRow = {
  title?: string | null
  description?: string | null
  routeText?: string | null
}

export { buildVisit as buildRegisterCityVisitHaystackFromSchedule }

export function buildRegisterGeoHaystackFromSchedule(rows: RegisterGeoScheduleRow[]): string | null {
  const parts: string[] = []
  for (const row of rows) {
    const dayParts = [row.title, row.description, row.routeText]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean)
    if (dayParts.length) parts.push(dayParts.join(' '))
  }
  const joined = parts.join('\n').trim()
  if (!joined) return null
  return joined.length > REGISTER_GEO_SCHEDULE_HAYSTACK_MAX
    ? joined.slice(0, REGISTER_GEO_SCHEDULE_HAYSTACK_MAX)
    : joined
}
