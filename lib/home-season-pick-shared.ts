/**
 * 시즌 추천 DTO + 클라이언트 안전 정규화만.
 * Prisma / object-storage / `node:crypto` 없음 — `use client` 번들에서 import 가능.
 */
import { resolveMonthlyCurationProductCountrySlug } from '@/lib/monthly-curation-product-country'

export type HomeSeasonPickDTO = {
  id: string
  title: string
  excerpt: string
  /** 원문 본문 — 더보기 펼침용 */
  bodyFull: string
  imageUrl: string | null
  ctaHref: string
  ctaLabel: string
  monthKey: string | null
  relatedCountryCode: string | null
  /** CMS 부제 — 카드 오버레이 */
  subtitle: string | null
  /** 상품 browse `country` 슬러그 — 필터·매칭용 */
  resolvedProductCountrySlug: string | null
}

export function excerptBody(body: string, max: number): string {
  const t = body.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
}

const FALLBACK_CTA_HREF = '/travel/overseas'
const FALLBACK_CTA_LABEL = '자세히 보기'

/** 시즌 슬라이드 이미지 URL — 정규화만(호스트별 제외 없음). */
export function stripSupabaseStorageForHomeSeasonImage(url: string | null): string | null {
  if (url == null) return null
  const t = url.trim()
  return t || null
}

/**
 * 클라이언트·서버 경계에서 잘못된/부분 객체가 섞여도 슬라이드 렌더가 죽지 않게 정규화한다.
 */
export function normalizeHomeSeasonSlidesForClient(input: unknown): HomeSeasonPickDTO[] {
  if (!Array.isArray(input)) return []
  const out: HomeSeasonPickDTO[] = []
  for (const el of input) {
    const row = normalizeHomeSeasonPickUnknown(el)
    if (row) out.push(row)
  }
  return out
}

function normalizeHomeSeasonPickUnknown(raw: unknown): HomeSeasonPickDTO | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id.trim() : String(r.id ?? '').trim()
  if (!id) return null

  const bodyFull = typeof r.bodyFull === 'string' ? r.bodyFull : String(r.bodyFull ?? '')
  const excerptRaw = typeof r.excerpt === 'string' ? r.excerpt : String(r.excerpt ?? '')
  const excerptTrim = excerptRaw.replace(/\s+/g, ' ').trim()
  const excerpt = excerptTrim || excerptBody(bodyFull.trim(), 120)

  let imageUrl: string | null = null
  if (typeof r.imageUrl === 'string' && r.imageUrl.trim()) {
    imageUrl = stripSupabaseStorageForHomeSeasonImage(r.imageUrl.trim())
  } else if (r.imageUrl === null || r.imageUrl === undefined) {
    imageUrl = null
  }

  let ctaHref = typeof r.ctaHref === 'string' ? r.ctaHref.trim() : String(r.ctaHref ?? '').trim()
  if (!ctaHref) ctaHref = FALLBACK_CTA_HREF

  const ctaLabel =
    (typeof r.ctaLabel === 'string' ? r.ctaLabel.trim() : String(r.ctaLabel ?? '').trim()) || FALLBACK_CTA_LABEL
  const title = typeof r.title === 'string' ? r.title.trim() : String(r.title ?? '').trim()

  const monthKey = typeof r.monthKey === 'string' && r.monthKey.trim() ? r.monthKey.trim() : null
  const relatedCountryCode =
    typeof r.relatedCountryCode === 'string' && r.relatedCountryCode.trim() ? r.relatedCountryCode.trim() : null
  const subtitle =
    typeof r.subtitle === 'string' && r.subtitle.trim() ? r.subtitle.trim() : null
  let resolvedProductCountrySlug =
    typeof r.resolvedProductCountrySlug === 'string' && r.resolvedProductCountrySlug.trim()
      ? r.resolvedProductCountrySlug.trim().toLowerCase()
      : null
  if (!resolvedProductCountrySlug) {
    resolvedProductCountrySlug = resolveMonthlyCurationProductCountrySlug(relatedCountryCode, title)
  }

  return {
    id,
    title,
    excerpt,
    bodyFull: bodyFull.trim(),
    imageUrl,
    ctaHref,
    ctaLabel,
    monthKey,
    relatedCountryCode,
    subtitle,
    resolvedProductCountrySlug,
  }
}
