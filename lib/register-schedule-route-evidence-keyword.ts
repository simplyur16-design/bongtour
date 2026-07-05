/**
 * 등록 schedule imageKeyword — 일정 텍스트에 없는 영문 랜드마크 환각 차단(6공급사 공통).
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: manifest
 */
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export type RegisterScheduleRouteEvidenceRow = {
  routeText?: string | null
  title?: string | null
  description?: string | null
}

function rowRouteEvidenceHaystack(row: RegisterScheduleRouteEvidenceRow): string {
  return [row.routeText, row.title, row.description]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

/** Forbidden City — routeText·title·description에 영문 literal이 없으면 거부(북경·city regex 환각 차단). */
export function registerScheduleKeywordPassesRouteEvidence(
  keyword: string | null | undefined,
  row: RegisterScheduleRouteEvidenceRow,
): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return true
  const hay = rowRouteEvidenceHaystack(row)
  const norm = normalizeToPlaceName(raw).toLowerCase()
  const mentionsForbidden =
    /\bforbidden\b/i.test(norm) ||
    /\bforbidden\b/i.test(raw) ||
    norm === 'forbidden city'
  if (mentionsForbidden) {
    return /forbidden\s*city/i.test(hay)
  }
  if (/\bParis\b/i.test(raw) || norm === 'paris') {
    if (/마이파리/u.test(hay)) return false
    return /(?<![가-힣])파리(?![가-힣])|\bParis\b/i.test(hay)
  }
  return true
}

export function sanitizeRegisterScheduleImageKeywordsFromRouteEvidence<
  T extends RegisterScheduleRouteEvidenceRow & {
    imageKeyword?: string | null
    imageKeyword2?: string | null
  },
>(rows: T[]): T[] {
  return rows.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    return {
      ...row,
      imageKeyword: kw && registerScheduleKeywordPassesRouteEvidence(kw, row) ? kw : '',
      imageKeyword2: kw2 && registerScheduleKeywordPassesRouteEvidence(kw2, row) ? kw2 : null,
    }
  })
}
