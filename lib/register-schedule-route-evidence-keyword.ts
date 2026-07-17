/**
 * 등록 schedule imageKeyword — 일정 텍스트에 없는 영문 랜드마크 환각 차단(6공급사 공통).
 * REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: manifest
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: trip routeText SSOT 키워드만 허용 — manifest
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: trip ctx — spot scan 포함 — manifest
 */
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  collectRouteTextOrderedImageKeywords,
  collectRouteTextOrderedLandmarkKeywords,
  collectRouteTextSpotScanLandmarkKeywords,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'
import { findAllScheduleSpotMatchesInText } from '@/lib/schedule-poi-regex-ssot'
import { hasRioDeJaneiroContext } from '@/lib/schedule-rio-de-janeiro-context'
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { appendRegisterScheduleCitySoftAltKeywordKeys } from '@/lib/register-schedule-city-soft-alts'
// REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: Christ Redeemer 리우 부분문자열 — manifest

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

export type RegisterScheduleTripRouteKeywordContext = {
  keywordKeys: ReadonlySet<string>
  hasRouteText: boolean
}

function isRegisterScheduleTripRouteKeywordContext(
  ctx: RegisterScheduleTripRouteKeywordContext | ReadonlySet<string>,
): ctx is RegisterScheduleTripRouteKeywordContext {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'keywordKeys' in ctx &&
    'hasRouteText' in ctx
  )
}

export function buildRegisterScheduleTripRouteKeywordContext(
  rows: readonly RegisterScheduleRouteEvidenceRow[],
): RegisterScheduleTripRouteKeywordContext {
  const keywordKeys = new Set<string>()
  let hasRouteText = false
  for (const row of rows) {
    if (String(row.routeText ?? '').trim()) hasRouteText = true
    const candidates = [
      ...collectRouteTextOrderedLandmarkKeywords(row.routeText),
      ...collectRouteTextOrderedImageKeywords(row.routeText),
      ...collectRouteTextSpotScanLandmarkKeywords(row.routeText),
    ]
    for (const kw of candidates) {
      const nk = normScheduleImageKeywordKey(kw)
      if (nk) keywordKeys.add(nk)
    }
    const hay = rowRouteEvidenceHaystack(row)
    for (const hit of findAllScheduleSpotMatchesInText(hay)) {
      const nk = normScheduleImageKeywordKey(hit.en)
      if (nk) keywordKeys.add(nk)
      try {
        const fin = normScheduleImageKeywordKey(finalizeScheduleImageKeyword(hit.en))
        if (fin) keywordKeys.add(fin)
      } catch {
        /* keep */
      }
    }
    // REGRESSION-FREEZE[register-schedule-forbidden-city-route-evidence]: city soft-alt trip SSOT — manifest
    appendRegisterScheduleCitySoftAltKeywordKeys(hay, keywordKeys)
  }
  return { keywordKeys, hasRouteText }
}

/** imageKeyword — trip 전체 routeText 세그먼트에서 유도 가능한 키만 허용 */
export function registerScheduleKeywordPassesTripRouteTextSsot(
  keyword: string | null | undefined,
  ctx: RegisterScheduleTripRouteKeywordContext | ReadonlySet<string>,
  row?: RegisterScheduleRouteEvidenceRow,
): boolean {
  const raw = String(keyword ?? '').trim()
  if (!raw) return true
  const tripCtx: RegisterScheduleTripRouteKeywordContext =
    isRegisterScheduleTripRouteKeywordContext(ctx)
      ? ctx
      : { keywordKeys: ctx, hasRouteText: ctx.size > 0 }
  const nk = normScheduleImageKeywordKey(raw)
  if (!nk) return false
  if (tripCtx.keywordKeys.has(nk)) return true
  if (row && String(row.routeText ?? '').trim()) {
    for (const hit of findAllScheduleSpotMatchesInText(rowRouteEvidenceHaystack(row))) {
      const variants = [hit.en]
      try {
        variants.push(finalizeScheduleImageKeyword(hit.en))
      } catch {
        /* keep */
      }
      for (const v of variants) {
        if (normScheduleImageKeywordKey(v) === nk) return true
      }
    }
  }
  if (!tripCtx.hasRouteText) return true
  return false
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
  if (/\bColosseum\b/i.test(raw) || /\bRome\b/i.test(raw)) {
    if (/(?:파타야|Pattaya|태국|Thailand|방콕|Bangkok).{0,80}(?:쇼|show)|(?:쇼|show).{0,40}(?:콜로세움|콜롯세움)/i.test(hay)) {
      return false
    }
    return /(?:콜로세움|콜로세um|로마|\bRome\b|\bColosseum\b)/i.test(hay)
  }
  if (/Tokyo\s*Disneyland/i.test(raw)) {
    return /(?:도쿄|디즈니|Tokyo|Disney)/i.test(hay)
  }
  if (/Christ\s*the\s*Redeemer/i.test(raw)) {
    const routeHay = [row.routeText, row.title].map((s) => String(s ?? '').trim()).filter(Boolean).join('\n')
    if (/(?:마나도|Manado|술라웨시|Sulawesi|인도네시아|Indonesia|부나켄|Bunaken|토모혼|Tomohon)/i.test(hay)) {
      return hasRioDeJaneiroContext(routeHay)
    }
    return hasRioDeJaneiroContext(hay)
  }
  if (/Griffith\s*Observatory/i.test(raw)) {
    return /(?:그리피스|Griffith|Los\s*Angeles|LA)/i.test(hay)
  }
  if (/\bGiza\b/i.test(raw) || /\bPyramid/i.test(raw)) {
    return /(?:기자|Giza|Pyramid|이집트|Egypt)/i.test(hay)
  }
  if (/\bNara\b/i.test(raw)) {
    return /(?:나라|Nara|奈良)/i.test(hay)
  }
  if (/\bPhuket\b/i.test(raw)) {
    return /(?:푸켓|Phuket)/i.test(hay)
  }
  return true
}

export function sanitizeRegisterScheduleImageKeywordsFromRouteEvidence<
  T extends RegisterScheduleRouteEvidenceRow & {
    imageKeyword?: string | null
    imageKeyword2?: string | null
  },
>(rows: T[]): T[] {
  const tripCtx = buildRegisterScheduleTripRouteKeywordContext(rows)
  return rows.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    const passesKw =
      registerScheduleKeywordPassesRouteEvidence(kw, row) &&
      registerScheduleKeywordPassesTripRouteTextSsot(kw, tripCtx, row)
    const passesKw2 =
      registerScheduleKeywordPassesRouteEvidence(kw2, row) &&
      registerScheduleKeywordPassesTripRouteTextSsot(kw2, tripCtx, row)
    return {
      ...row,
      imageKeyword: kw && passesKw ? kw : '',
      imageKeyword2: kw2 && passesKw2 ? kw2 : null,
    }
  })
}
