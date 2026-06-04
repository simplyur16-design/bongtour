/**
 * 자유여행 일정 — routeText 세그먼트에서 일차별 imageKeyword (Fit·LLM 폴백 보완).
 */
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import {
  collectRouteLandmarkKeywordsFromRouteText,
} from '@/lib/ybtour-schedule-image-keyword'

export type AirtelRouteImageKeywordRow = {
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function isWeakAirtelImageKeyword(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (/^nha$/i.test(t)) return true
  if (/^nha\s*trang$/i.test(t)) return true
  if (isBareCityOrCountryKeyword(t)) return true
  return false
}

function pickDistinctRouteLandmarksForRow(
  list: string[],
  usedPrimaryLower: Set<string>,
): { imageKeyword: string; imageKeyword2: string | null } {
  let imageKeyword = ''
  for (const kw of list) {
    const lower = kw.toLowerCase()
    if (usedPrimaryLower.has(lower)) continue
    imageKeyword = kw
    usedPrimaryLower.add(lower)
    break
  }
  let imageKeyword2: string | null = null
  for (const kw of list) {
    if (kw.toLowerCase() === imageKeyword.toLowerCase()) continue
    imageKeyword2 = kw
    break
  }
  return { imageKeyword, imageKeyword2 }
}

/** routeText 관광지로 Nha·Nha Trang·도시 폴백 덮어씀 — 일차별 1순위는 전역 중복 회피 */
export function applyAirtelRouteTextImageKeywordsToSchedule<T extends AirtelRouteImageKeywordRow>(
  rows: T[],
): T[] {
  const usedPrimaryLower = new Set<string>()

  return rows.map((row) => {
    const rt = String(row.routeText ?? '').trim()
    if (!rt) return row

    const list = collectRouteLandmarkKeywordsFromRouteText(rt)
    if (!list.length) return row

    const picked = pickDistinctRouteLandmarksForRow(list, usedPrimaryLower)
    if (!picked.imageKeyword) return row

    const current = String(row.imageKeyword ?? '').trim()
    const routeIsLandmark = !isWeakAirtelImageKeyword(picked.imageKeyword)
    const shouldReplace = routeIsLandmark && (isWeakAirtelImageKeyword(current) || !current)

    if (!shouldReplace) {
      if (picked.imageKeyword2 && !String(row.imageKeyword2 ?? '').trim()) {
        return { ...row, imageKeyword2: picked.imageKeyword2 }
      }
      return row
    }

    return {
      ...row,
      imageKeyword: picked.imageKeyword,
      imageKeyword2: picked.imageKeyword2 ?? row.imageKeyword2 ?? null,
    }
  })
}
