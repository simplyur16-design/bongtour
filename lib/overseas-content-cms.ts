import { toSafePublicUrlOrPath } from '@/lib/cms-source-attribution'

export type ContentScope = 'overseas' | 'domestic'

export type EditorialFormInput = {
  pageScope: string
  regionKey: string | null
  countryCode: string | null
  title: string
  subtitle: string | null
  bodyKr: string
  heroImageUrl: string | null
  heroImageAlt: string | null
  heroImageStorageKey: string | null
  heroImageWidth: number | null
  heroImageHeight: number | null
  sourceType: string | null
  sourceName: string | null
  sourceUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  slug: string | null
  privateTripHeroSlot: boolean
  ctaLabel: string | null
  ctaHref: string | null
  cardTags: string | null
  isPublished: boolean
  sortOrder: number
}

export type MonthlyContentFormInput = {
  pageScope: string
  monthKey: string
  regionKey: string | null
  countryCode: string | null
  title: string
  subtitle: string | null
  bodyKr: string
  ctaLabel: string | null
  linkedProductId: string | null
  linkedHref: string | null
  imageUrl: string | null
  imageAlt: string | null
  imageStorageKey: string | null
  imageWidth: number | null
  imageHeight: number | null
  sourceType: string | null
  sourceName: string | null
  sourceUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  slug: string | null
  isPublished: boolean
  sortOrder: number
}

function toTrimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function toNullableTrimmed(v: unknown): string | null {
  const s = toTrimmedString(v)
  return s.length > 0 ? s : null
}

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1'
  return fallback
}

function toInt(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function normalizeScope(v: unknown): ContentScope {
  const s = toTrimmedString(v).toLowerCase()
  return s === 'domestic' ? 'domestic' : 'overseas'
}

function isMonthKey(v: string): boolean {
  return /^\d{4}-\d{2}$/.test(v)
}

function sanitizeHttpUrl(v: string | null): string | null {
  if (!v) return null
  try {
    const url = new URL(v)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** 단독여행 CTA: 내부 경로(/) 또는 https */
function sanitizeEditorialCtaHref(v: string | null): string | null {
  if (!v) return null
  const s = v.trim()
  if (s.startsWith('/')) return s
  return sanitizeHttpUrl(s)
}

export function parseEditorialInput(body: unknown): { ok: true; data: EditorialFormInput } | { ok: false; errors: Record<string, string> } {
  const b = (body ?? {}) as Record<string, unknown>
  const title = toTrimmedString(b.title)
  const bodyKr = toTrimmedString(b.bodyKr)
  const errors: Record<string, string> = {}
  if (!title) errors.title = '제목은 필수입니다.'
  if (!bodyKr) errors.bodyKr = '본문은 필수입니다.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    data: {
      pageScope: normalizeScope(b.pageScope ?? b.contentScope),
      regionKey: toNullableTrimmed(b.regionKey),
      countryCode: toNullableTrimmed(b.countryCode),
      title,
      subtitle: toNullableTrimmed(b.subtitle),
      bodyKr,
      heroImageUrl: toSafePublicUrlOrPath(toNullableTrimmed(b.heroImageUrl)),
      heroImageAlt: toNullableTrimmed(b.heroImageAlt),
      heroImageStorageKey: toNullableTrimmed(b.heroImageStorageKey),
      heroImageWidth: (() => {
        const n = toInt(b.heroImageWidth, -1)
        return n >= 0 ? n : null
      })(),
      heroImageHeight: (() => {
        const n = toInt(b.heroImageHeight, -1)
        return n >= 0 ? n : null
      })(),
      sourceType: toNullableTrimmed(b.sourceType),
      sourceName: toNullableTrimmed(b.sourceName),
      sourceUrl: sanitizeHttpUrl(toNullableTrimmed(b.sourceUrl)),
      seoTitle: toNullableTrimmed(b.seoTitle),
      seoDescription: toNullableTrimmed(b.seoDescription),
      slug: toNullableTrimmed(b.slug),
      privateTripHeroSlot: toBool(b.privateTripHeroSlot, false),
      ctaLabel: toNullableTrimmed(b.ctaLabel),
      ctaHref: sanitizeEditorialCtaHref(toNullableTrimmed(b.ctaHref)),
      cardTags: toNullableTrimmed(b.cardTags),
      isPublished: toBool(b.isPublished, false),
      sortOrder: toInt(b.sortOrder, 0),
    },
  }
}

export function parseMonthlyContentInput(body: unknown): { ok: true; data: MonthlyContentFormInput } | { ok: false; errors: Record<string, string> } {
  const b = (body ?? {}) as Record<string, unknown>
  const title = toTrimmedString(b.title)
  const bodyKr = toTrimmedString(b.bodyKr)
  const monthKey = toTrimmedString(b.monthKey)
  const errors: Record<string, string> = {}
  if (!monthKey) errors.monthKey = 'monthKey는 필수입니다.'
  else if (!isMonthKey(monthKey)) errors.monthKey = 'monthKey 형식은 YYYY-MM 이어야 합니다.'
  if (!title) errors.title = '제목은 필수입니다.'
  if (!bodyKr) errors.bodyKr = '본문은 필수입니다.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const sanitizedImageUrl = toSafePublicUrlOrPath(toNullableTrimmed(b.imageUrl))

  return {
    ok: true,
    data: {
      pageScope: normalizeScope(b.pageScope ?? b.contentScope),
      monthKey,
      regionKey: toNullableTrimmed(b.regionKey),
      countryCode: toNullableTrimmed(b.countryCode),
      title,
      subtitle: toNullableTrimmed(b.subtitle),
      bodyKr,
      ctaLabel: toNullableTrimmed(b.ctaLabel),
      linkedProductId: toNullableTrimmed(b.linkedProductId),
      linkedHref: toSafePublicUrlOrPath(toNullableTrimmed(b.linkedHref)),
      imageUrl: sanitizedImageUrl,
      imageAlt: toNullableTrimmed(b.imageAlt),
      imageStorageKey: toNullableTrimmed(b.imageStorageKey),
      imageWidth: (() => {
        const n = toInt(b.imageWidth, -1)
        return n >= 0 ? n : null
      })(),
      imageHeight: (() => {
        const n = toInt(b.imageHeight, -1)
        return n >= 0 ? n : null
      })(),
      sourceType: toNullableTrimmed(b.sourceType),
      sourceName: toNullableTrimmed(b.sourceName),
      sourceUrl: sanitizeHttpUrl(toNullableTrimmed(b.sourceUrl)),
      seoTitle: toNullableTrimmed(b.seoTitle),
      seoDescription: toNullableTrimmed(b.seoDescription),
      slug: toNullableTrimmed(b.slug),
      isPublished: toBool(b.isPublished, false),
      sortOrder: toInt(b.sortOrder, 0),
    },
  }
}

