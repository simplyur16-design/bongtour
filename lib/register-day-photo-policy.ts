/**
 * 일차 사진 정책 검사 — 채울 때(process-images v2)와 자동 등록 검사(register-auto-register-gate)가 같은 기준을 쓴다.
 * 기준: 가로 1200px 이상 · 신규 iStock 금지 · CC BY(출처 표시 의무) 금지 · 상세 400,000B 미만 · 도시/명소 일치.
 * 관리자가 고른 사진(imageManualSelected)은 바꾸지 않으므로 용량만 본다.
 * REGRESSION-FREEZE[register-day-photo-policy]: 일차 사진 1200px·iStock 신규·CC BY·용량·도시 일치 — manifest
 */
import { evaluateImageCandidatePolicy, IMAGE_MIN_WIDTH, type ImagePolicyFailCode } from '@/lib/product-image-source-policy'
import { cityLocationVerdict, englishCityTerms } from '@/lib/pexels-city-location-filter'
import { mapDestination } from '@/lib/pexels-keyword'

/** 상세 화면 사진(일차 사진) 상한 — register-auto-register-gate 와 같은 값 */
export const DAY_PHOTO_DETAIL_MAX_BYTES = 400_000

/** 채울 때 기록하는 도시 일치 근거: meta=사진 설명·주소에 도시/명소, pool=같은 도시 풀, keyword=일차 키워드로 찾음/생성 */
export type DayCityMatch = 'meta' | 'pool' | 'keyword' | 'admin'

export type DayPhotoCheckInput = {
  url: string
  source: string | null
  photographer?: string | null
  originalLink?: string | null
  license?: string | null
  isGenerated?: boolean | null
  prompt?: string | null
  width: number | null
  bytes: number | null
  manual?: boolean
}

export type DayPhotoCheckReason = 'not_measured' | 'low_res' | 'over_bytes' | `policy:${ImagePolicyFailCode}`

export function checkDayPhotoPolicy(p: DayPhotoCheckInput): { ok: boolean; reasons: DayPhotoCheckReason[] } {
  const reasons: DayPhotoCheckReason[] = []
  if (p.bytes == null || p.width == null) return { ok: false, reasons: ['not_measured'] }
  if (p.bytes >= DAY_PHOTO_DETAIL_MAX_BYTES) reasons.push('over_bytes')
  if (p.manual) return { ok: reasons.length === 0, reasons }
  if (p.width < IMAGE_MIN_WIDTH) reasons.push('low_res')
  const pol = evaluateImageCandidatePolicy({
    source: p.source,
    url: p.url,
    license: p.license ?? null,
    isGenerated: p.isGenerated === true || /gemini|generated/i.test(String(p.source ?? '')),
    prompt: p.prompt ?? null,
    photographer: p.photographer ?? null,
    authorProfileUrl: p.originalLink ?? null,
    originalLink: p.originalLink ?? null,
    width: p.width,
  })
  for (const f of pol.fails) if (f !== 'T1-RES') reasons.push(`policy:${f}`)
  return { ok: reasons.length === 0, reasons }
}

/** 후보 사진(설명·페이지 주소)이 일차 도시 또는 명소를 가리키는지 */
export function dayCandidateCityMatch(
  c: { altText?: string | null; pageUrl?: string | null },
  cityValues: Array<string | null | undefined>,
  landmarks: Array<string | null | undefined> = []
): DayCityMatch | null {
  const cities = englishCityTerms([...cityValues, ...cityValues.map((v) => (v ? mapDestination(v) : null))])
  const lms = landmarks.map((x) => String(x ?? '').trim().toLowerCase()).filter((x) => x.length >= 3)
  const v = cityLocationVerdict({ alt: c.altText ?? null, pageUrl: c.pageUrl ?? null }, cities, lms)
  return v.verdict === 'OK' ? 'meta' : null
}

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[\s\-_.,·]/g, '')
}

/**
 * 자동 등록 검사용: 일차 사진의 도시 일치가 확인됐는지.
 * 채울 때 남긴 근거(imageSource.cityMatch)가 있거나, 일차 키워드가 그 일차 일정 글 또는 상품 목적지에 있으면 확인으로 본다.
 */
export function dayPhotoCityVerified(
  row: { imageKeyword?: unknown; title?: unknown; description?: unknown; routeText?: unknown; imageSource?: unknown },
  productText: { destination?: string | null; title?: string | null }
): boolean {
  const src = row.imageSource && typeof row.imageSource === 'object' ? (row.imageSource as Record<string, unknown>) : {}
  const cm = typeof src.cityMatch === 'string' ? src.cityMatch : ''
  if (cm === 'meta' || cm === 'pool' || cm === 'keyword' || cm === 'admin') return true
  const kw = norm(row.imageKeyword)
  if (kw.length < 2 || /^day\d+$/.test(kw)) return false
  const hay = [row.title, row.description, row.routeText, productText.destination, productText.title, mapDestination(productText.destination ?? null)]
    .map(norm)
    .join('|')
  return hay.includes(kw)
}
