/**
 * `Product.schedule` JSON → 일정 `imageKeyword` 추출 — 대표 SEO 키워드 최후 보조 단계만.
 */

import { isProductHeroListingSeoContaminated } from '@/lib/product-hero-listing-seo-contamination'

const AUX_SCHEDULE_BAN_RE =
  /\bairport\b|\bairports\b|\bshopping\b|\bmeeting\b|\boption\b|\boptions\b|\bdeparture\b|\barrival\b|\bduty\s*free\b|\bterminal\b|\btransfer\b|인천\s*공항|김포\s*공항|공항\s*미팅|공항\s*도착|공항\s*출발|현지\s*미팅|선택관광|현지옵션|쇼핑\s*\d|옵션\s*\d|출발|도착|이동/i

const FILE_STOCK_RES: readonly RegExp[] = [
  /\bpexels\b/i,
  /\bistock\b/i,
  /\.(jpe?g|png|webp)(\b|[\s?#]|$)/i,
  /https?:\/\//i,
  /\b\d{5,}\b/,
]

function scheduleKeywordContaminated(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (isProductHeroListingSeoContaminated(t)) return true
  if (AUX_SCHEDULE_BAN_RE.test(t)) return true
  for (const re of FILE_STOCK_RES) {
    if (re.test(t)) return true
  }
  return false
}

/** `schedule` JSON 배열에서 `imageKeyword` 문자열만 수집(파싱 실패 시 []). */
export function collectImageKeywordsFromProductScheduleJson(
  scheduleJson: string | null | undefined,
  max = 16
): string[] {
  const raw = (scheduleJson ?? '').trim()
  if (!raw || raw.length > 200_000) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const item of arr) {
      if (out.length >= max) break
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const ik = (item as { imageKeyword?: unknown }).imageKeyword
      if (typeof ik !== 'string') continue
      const s = ik.replace(/\s+/g, ' ').trim()
      if (s.length < 2 || scheduleKeywordContaminated(s)) continue
      const k = s.replace(/\s/g, '')
      if (seen.has(k)) continue
      seen.add(k)
      out.push(s.slice(0, 48))
    }
    return out
  } catch {
    return []
  }
}

export function mergeScheduleImageKeywordSources(
  explicit: readonly string[] | null | undefined,
  scheduleJson: string | null | undefined
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim()
    if (t.length < 2 || scheduleKeywordContaminated(t)) return
    const k = t.replace(/\s/g, '')
    if (seen.has(k)) return
    seen.add(k)
    out.push(t.slice(0, 48))
  }
  for (const x of explicit ?? []) push(String(x))
  for (const x of collectImageKeywordsFromProductScheduleJson(scheduleJson)) push(x)
  return out.slice(0, 20)
}

/** 최후 보조: 장소·관광지형만(한글 2자+ 또는 다어절 고유명). */
export function isEligibleScheduleImageKeywordForLastResortSeo(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length < 2 || t.length > 40) return false
  if (scheduleKeywordContaminated(t)) return false
  const hangul = (t.match(/[가-힣]/g) || []).length
  if (hangul >= 2) return true
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 2 && words.length <= 6 && /^[A-Za-z]/.test(t) && !/\d{3,}/.test(t)) return true
  if (words.length === 1 && /^[A-Z][a-z]{5,24}$/.test(words[0]!)) return true
  return false
}
