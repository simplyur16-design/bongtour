import type { ReviewCategory, ReviewMemberSubmitInput, ReviewType } from '@/lib/reviews-types'

const CATEGORIES: ReviewCategory[] = ['overseas', 'domestic', 'training']
const REVIEW_TYPES: ReviewType[] = [
  'solo',
  'group_small',
  'group_corporate',
  'group_friends',
  'family',
  'parents',
  'hiking',
]

const LAUNCH_DATE = '2025-01-07'

const TITLE_MIN = 4
const TITLE_MAX = 200
const EXCERPT_MIN = 10
const EXCERPT_MAX = 800
const BODY_MAX = 20_000
const MAX_TAG_LEN = 40
const MAX_TAGS = 12
const MAX_URL = 2048
const MAX_LABEL = 80
const MAX_DEST = 120
const MAX_CUSTOMER_TYPE = 120

function isIsoDateOrMonth(s: string): boolean {
  return /^\d{4}-\d{2}(-\d{2})?$/.test(s)
}

function parseMonthToDate(s: string): string | null {
  const t = s.trim().slice(0, 10)
  if (t.length === 7) return `${t}-01`
  if (t.length === 10) return t
  return null
}

function isOnOrAfterLaunch(dateStr: string): boolean {
  const d = dateStr.slice(0, 10)
  return d >= LAUNCH_DATE
}

const ALLOWED_MEMBER_KEYS = new Set([
  'category',
  'review_type',
  'title',
  'excerpt',
  'body',
  'customer_type',
  'destination_country',
  'destination_city',
  'tags',
  'travel_month',
  'rating_label',
  'thumbnail_url',
])

export type ValidateSubmitResult =
  | { ok: true; value: ReviewMemberSubmitInput }
  | { ok: false; error: string; code?: 'auth' | 'validation' | 'server' }

export function validateMemberReviewSubmit(body: unknown): ValidateSubmitResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: '잘못된 요청 본문입니다.', code: 'validation' }
  }
  const o = body as Record<string, unknown>

  for (const k of Object.keys(o)) {
    if (!ALLOWED_MEMBER_KEYS.has(k)) {
      return { ok: false, error: `허용되지 않는 필드: ${k}`, code: 'validation' }
    }
  }

  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const excerpt = typeof o.excerpt === 'string' ? o.excerpt.trim() : ''
  if (title.length < TITLE_MIN) return { ok: false, error: `제목은 ${TITLE_MIN}자 이상 입력해 주세요.`, code: 'validation' }
  if (!excerpt) return { ok: false, error: '요약을 입력해 주세요.', code: 'validation' }
  if (title.length > TITLE_MAX) return { ok: false, error: `제목은 ${TITLE_MAX}자 이내입니다.`, code: 'validation' }
  if (excerpt.length < EXCERPT_MIN) {
    return { ok: false, error: `요약은 ${EXCERPT_MIN}자 이상 입력해 주세요.`, code: 'validation' }
  }
  if (excerpt.length > EXCERPT_MAX) return { ok: false, error: `요약은 ${EXCERPT_MAX}자 이내입니다.`, code: 'validation' }

  const catRaw = o.category != null ? String(o.category).trim() : 'overseas'
  if (!CATEGORIES.includes(catRaw as ReviewCategory)) {
    return { ok: false, error: '유효하지 않은 여행 구분(category)입니다.', code: 'validation' }
  }
  const category = catRaw as ReviewCategory

  const rtRaw = o.review_type != null ? String(o.review_type).trim() : ''
  if (!rtRaw || !REVIEW_TYPES.includes(rtRaw as ReviewType)) {
    return { ok: false, error: '여행 유형(review_type)을 선택해 주세요.', code: 'validation' }
  }
  const review_type = rtRaw as ReviewType

  const str = (k: string, max: number, optional = true): string | null | undefined | '__too_long__' => {
    if (!(k in o)) return optional ? undefined : ''
    const v = o[k]
    if (v == null) return null
    if (typeof v !== 'string') return optional ? undefined : ''
    const t = v.trim()
    if (!t) return null
    if (t.length > max) return '__too_long__'
    return t
  }

  const bodyText = str('body', BODY_MAX, true)
  if (bodyText === '__too_long__') return { ok: false, error: `본문은 ${BODY_MAX}자 이내입니다.`, code: 'validation' }

  const customer_type = str('customer_type', MAX_CUSTOMER_TYPE, true)
  if (customer_type === '__too_long__') return { ok: false, error: 'customer_type 길이 초과', code: 'validation' }

  const destination_country = str('destination_country', MAX_DEST, true)
  if (destination_country === '__too_long__') return { ok: false, error: 'destination_country 길이 초과', code: 'validation' }

  const destination_city = str('destination_city', MAX_DEST, true)
  if (destination_city === '__too_long__') return { ok: false, error: 'destination_city 길이 초과', code: 'validation' }

  const rating_label = str('rating_label', MAX_LABEL, true)
  if (rating_label === '__too_long__') return { ok: false, error: 'rating_label 길이 초과', code: 'validation' }

  let thumbnail_url: string | null | undefined
  if ('thumbnail_url' in o) {
    const u = o.thumbnail_url
    if (u == null) thumbnail_url = null
    else if (typeof u === 'string') {
      const t = u.trim()
      if (!t) thumbnail_url = null
      else if (t.length > MAX_URL || !/^https:\/\//i.test(t)) {
        return { ok: false, error: 'thumbnail_url 은 https URL 이어야 합니다.', code: 'validation' }
      } else thumbnail_url = t
    } else return { ok: false, error: 'thumbnail_url 형식이 올바르지 않습니다.', code: 'validation' }
  }

  let travel_month: string | null | undefined
  if ('travel_month' in o) {
    const v = o.travel_month
    if (v == null) travel_month = null
    else if (typeof v === 'string') {
      const t = v.trim()
      if (!t) travel_month = null
      else if (!isIsoDateOrMonth(t)) {
        return { ok: false, error: 'travel_month 는 YYYY-MM 또는 YYYY-MM-DD 형식입니다.', code: 'validation' }
      } else {
        const normalized = parseMonthToDate(t)
        if (!normalized || !isOnOrAfterLaunch(normalized)) {
          return {
            ok: false,
            error: `여행 시기는 ${LAUNCH_DATE} 이후만 입력할 수 있습니다.`,
            code: 'validation',
          }
        }
        travel_month = normalized
      }
    } else return { ok: false, error: 'travel_month 형식이 올바르지 않습니다.', code: 'validation' }
  }

  let tags: string[] | undefined
  if ('tags' in o) {
    const v = o.tags
    if (v == null) tags = []
    else if (!Array.isArray(v)) return { ok: false, error: 'tags 는 문자열 배열이어야 합니다.', code: 'validation' }
    else {
      const out: string[] = []
      for (const x of v) {
        if (typeof x !== 'string') return { ok: false, error: 'tags 항목은 문자열이어야 합니다.', code: 'validation' }
        const t = x.trim()
        if (!t) continue
        if (t.length > MAX_TAG_LEN) return { ok: false, error: `태그는 ${MAX_TAG_LEN}자 이내입니다.`, code: 'validation' }
        out.push(t)
        if (out.length > MAX_TAGS) return { ok: false, error: `태그는 최대 ${MAX_TAGS}개입니다.`, code: 'validation' }
      }
      tags = out
    }
  }

  const value: ReviewMemberSubmitInput = {
    category,
    review_type,
    title,
    excerpt,
    body: bodyText === undefined ? undefined : bodyText,
    customer_type: customer_type === undefined ? undefined : customer_type,
    destination_country: destination_country === undefined ? undefined : destination_country,
    destination_city: destination_city === undefined ? undefined : destination_city,
    tags,
    travel_month: travel_month === undefined ? undefined : travel_month,
    rating_label: rating_label === undefined ? undefined : rating_label,
    thumbnail_url: thumbnail_url === undefined ? undefined : thumbnail_url,
  }

  return { ok: true, value }
}
