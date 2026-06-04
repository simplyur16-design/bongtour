/**
 * 자유여행 일정 — routeText 세그먼트에서 일차별 imageKeyword (Fit·LLM 폴백 보완).
 */
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { pickRouteLandmarkImageKeywordsFromRouteText } from '@/lib/ybtour-schedule-image-keyword'

export type AirtelRouteImageKeywordRow = {
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function isWeakAirtelImageKeyword(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (/^nha$/i.test(t)) return true
  if (isBareCityOrCountryKeyword(t)) return true
  return false
}

/** routeText에 관광지가 있으면 1·2순위 키워드를 route 기준으로 덮어씀(Fit/도시 폴백이 Nha 등일 때) */
export function applyAirtelRouteTextImageKeywordsToSchedule<T extends AirtelRouteImageKeywordRow>(
  rows: T[],
): T[] {
  return rows.map((row) => {
    const rt = String(row.routeText ?? '').trim()
    if (!rt) return row
    const picked = pickRouteLandmarkImageKeywordsFromRouteText(rt)
    if (!picked.imageKeyword) return row
    const current = String(row.imageKeyword ?? '').trim()
    const routeIsLandmark = !isWeakAirtelImageKeyword(picked.imageKeyword)
    const currentIsNha = /^nha$/i.test(current)
    const shouldReplaceKw1 =
      routeIsLandmark && (currentIsNha || isWeakAirtelImageKeyword(current) || !current)

    if (shouldReplaceKw1) {
      return {
        ...row,
        imageKeyword: picked.imageKeyword,
        imageKeyword2: picked.imageKeyword2 ?? row.imageKeyword2 ?? null,
      }
    }
    if (!routeIsLandmark && isWeakAirtelImageKeyword(current) && picked.imageKeyword) {
      return {
        ...row,
        imageKeyword: picked.imageKeyword,
        imageKeyword2: picked.imageKeyword2 ?? row.imageKeyword2 ?? null,
      }
    }
    if (routeIsLandmark && picked.imageKeyword2 && !String(row.imageKeyword2 ?? '').trim()) {
      return { ...row, imageKeyword2: picked.imageKeyword2 }
    }
    return row
  })
}
