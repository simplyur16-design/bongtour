/**
 * 등록 schedule — imageKeyword apply 전 routeText 최소 보정 (서버 post-augment·클라이언트 preview 공용).
 * REGRESSION-FREEZE[register-schedule-route-expression-normalize]: 신규 등록 routeText·요약 오염 차단 — manifest
 */
import {
  isRegisterScheduleGenericTourismFillerRouteText,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'

export type RegisterScheduleRouteTextBackfillRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
}

const REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX = 7

/** API·LLM placeholder 요약 — 장소 동선이 있으면 description에 쓰지 않음 */
export function isRegisterScheduleGenericTourismFillerDescription(
  desc: string | null | undefined,
): boolean {
  const t = String(desc ?? '').trim()
  if (!t) return true
  if (isRegisterScheduleGenericTourismFillerRouteText(t)) return true
  return /세련된 번화가|걷는 즐거움이|알찬 도보|이동과 관광이|여정의 여운|귀국길로 이어지|현지 도착 후 첫날|마무리 관광 뒤/i.test(
    t,
  )
}

/**
 * 신규 등록 일차 표현 — routeText a–g만 SSOT. 마케팅 카드·placeholder 요약은 title/description에 넣지 않음.
 * (기존 DB 재파싱이 아니라 parse → preview → confirm 경로 전 공급사 공통)
 */
export function normalizeRegisterScheduleRouteExpressionRow<T extends RegisterScheduleRouteTextBackfillRow>(
  row: T,
): T {
  const routeText =
    sanitizeRegisterScheduleRouteText(row.routeText, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX) ??
    sanitizeRegisterScheduleRouteText(row.title, REGISTER_SCHEDULE_ROUTE_EXPRESSION_MAX)
  if (!routeText) return row

  const title = String(row.title ?? '').trim()
  const description = String(row.description ?? '').trim()
  const titleLooksLikeRoute = /\s[-–—→]\s/u.test(title)
  const nextTitle =
    !title ||
    title === `${row.day}일차` ||
    isRegisterScheduleGenericTourismFillerDescription(title) ||
    (titleLooksLikeRoute && title.length > routeText.length)
      ? routeText
      : title
  const nextDescription = isRegisterScheduleGenericTourismFillerDescription(description)
    ? routeText
    : description || routeText

  return {
    ...row,
    routeText,
    title: nextTitle,
    description: nextDescription,
  }
}

export function normalizeRegisterScheduleRouteExpressionRows<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return rows.map((row) => normalizeRegisterScheduleRouteExpressionRow(row))
}

/** 마지막·기내박 일차 — routeText 없을 때 title로 최소 보정 */
export function backfillEmptyScheduleRouteTextFromTitle<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  if (!rows.length) return rows
  const maxDay = Math.max(...rows.map((r) => Number(r.day)).filter((d) => d > 0))
  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0 || String(row.routeText ?? '').trim()) return row
    const title = String(row.title ?? '').trim()
    if (!title) return row
    if (day === maxDay && /^(?:인천|김포|ICN|GMP)$/iu.test(title)) {
      return { ...row, routeText: title }
    }
    if (/^기내박$/u.test(title)) {
      return { ...row, routeText: '기내박' }
    }
    return row
  })
}

/** description/title 1줄에 `A - B - C` 동선이 있으면 routeText로 승격 */
export function backfillScheduleRouteTextFromDescriptionOrTitle<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return rows.map((row) => {
    if (String(row.routeText ?? '').trim()) return row
    for (const src of [String(row.description ?? '').trim(), String(row.title ?? '').trim()]) {
      if (!src) continue
      const firstLine = src.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ''
      if (!firstLine || firstLine.length < 8) continue
      if (/\s[-–—→]\s|[-–—→].*[-–—→]/u.test(firstLine)) {
        return { ...row, routeText: firstLine.slice(0, 500) }
      }
    }
    return row
  })
}

export function prepareRegisterScheduleRowsForImageKeywordApply<T extends RegisterScheduleRouteTextBackfillRow>(
  rows: T[],
): T[] {
  return normalizeRegisterScheduleRouteExpressionRows(
    backfillScheduleRouteTextFromDescriptionOrTitle(backfillEmptyScheduleRouteTextFromTitle(rows)),
  )
}
