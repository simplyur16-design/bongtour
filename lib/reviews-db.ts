/**
 * public.travel_reviews — 공개 조회는 RLS(published)용 클라이언트(anon 우선), 쓰기·관리자는 service role.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  ReviewCardModel,
  ReviewCategory,
  ReviewMemberSubmitInput,
  ReviewRow,
  ReviewStatus,
} from '@/lib/reviews-types'

const TABLE = 'travel_reviews'

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** 공개 후기 읽기: URL·키 불일치(service role 다른 프로젝트) 시 anon+공개 URL 조합을 우선 */
let cachedPublicReadClient: SupabaseClient | null | undefined

function resolveSupabaseUrlForRead(): string {
  return (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
}

function getSupabaseForTravelReviewsPublicRead(): SupabaseClient | null {
  if (cachedPublicReadClient !== undefined) return cachedPublicReadClient
  const url = resolveSupabaseUrlForRead()
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  const key = anon || service
  if (!url || !key) {
    cachedPublicReadClient = null
    return null
  }
  cachedPublicReadClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedPublicReadClient
}

function hasTravelReviewsPublicReadConfig(): boolean {
  const url = resolveSupabaseUrlForRead()
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return Boolean(url && (anon || service))
}

const cardSelect =
  'id,title,excerpt,review_type,customer_type,destination_country,destination_city,rating_label,tags,travel_month,displayed_date,thumbnail_url'

function mapToCard(row: Record<string, unknown>): ReviewCardModel {
  const tags = Array.isArray(row.tags) ? (row.tags as string[]).filter((t) => typeof t === 'string' && t.trim()) : []
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    excerpt: String(row.excerpt ?? ''),
    review_type: String(row.review_type ?? 'solo') as ReviewCardModel['review_type'],
    customer_type: row.customer_type != null ? String(row.customer_type) : null,
    destination_country: row.destination_country != null ? String(row.destination_country) : null,
    destination_city: row.destination_city != null ? String(row.destination_city) : null,
    rating_label: row.rating_label != null ? String(row.rating_label) : null,
    tags,
    travel_month: row.travel_month != null ? String(row.travel_month).slice(0, 10) : null,
    displayed_date: row.displayed_date != null ? String(row.displayed_date).slice(0, 10) : null,
    thumbnail_url: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
  }
}

function derivedDisplayedDateOnSubmit(travelMonth: string | null | undefined): string | null {
  if (!travelMonth?.trim()) return null
  const t = travelMonth.trim().slice(0, 10)
  if (t.length === 7) return `${t}-01`
  return t
}

/**
 * 해외·게시(published) 후기 건수. 공개 메타 문구용.
 * pending / rejected / archived 는 제외(고객 노출과 동일 기준).
 */
export async function countOverseasPublishedReviews(): Promise<number> {
  if (!hasTravelReviewsPublicReadConfig()) return 0
  try {
    const supabase = getSupabaseForTravelReviewsPublicRead()
    if (!supabase) return 0
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('category', 'overseas' satisfies ReviewCategory)
      .eq('status', 'published')

    if (error) {
      console.error('[reviews] countOverseasPublishedReviews', error.message)
      return 0
    }
    return typeof count === 'number' ? count : 0
  } catch (e) {
    console.error('[reviews] countOverseasPublishedReviews', e)
    return 0
  }
}

/**
 * 해외 랜딩 하단 그리드: category=overseas · published 전체.
 * 정렬: 대표(is_featured) 먼저 → display_order → 노출일 내림차순.
 * 첫 화면 6장만 쓸 때는 `getFeaturedOverseasReviews`; 전체 목록·더보기·별도 페이지는 본 함수로 분리 연결.
 * (쿼리에 `.eq('status', 'published')` 고정 — pending/rejected 미포함.)
 */
export async function listOverseasPublishedReviewCards(limit = 21): Promise<ReviewCardModel[]> {
  const lim = Math.min(50, Math.max(1, limit))
  if (!hasTravelReviewsPublicReadConfig()) {
    if (process.env.NODE_ENV === 'development') console.warn('[reviews] Supabase 미설정')
    return []
  }
  try {
    const supabase = getSupabaseForTravelReviewsPublicRead()
    if (!supabase) return []
    const { data, error } = await supabase
      .from(TABLE)
      .select(cardSelect)
      .eq('category', 'overseas' satisfies ReviewCategory)
      .eq('status', 'published')
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('displayed_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(lim)

    if (error) {
      console.error('[reviews] listOverseasPublishedReviewCards', error.message)
      return []
    }
    return ((data ?? []) as Record<string, unknown>[])
      .map(mapToCard)
      .filter((r) => r.id && r.title && r.excerpt)
  } catch (e) {
    console.error('[reviews] listOverseasPublishedReviewCards', e)
    return []
  }
}

/**
 * 해외 랜딩 첫 화면·API: 게시(published) + 대표(is_featured) 만.
 * (전체 published 목록은 `listOverseasPublishedReviewCards`.)
 * (쿼리에 `.eq('status', 'published')` 고정 — pending/rejected 미포함.)
 */
export async function getFeaturedOverseasReviews(limit = 6): Promise<ReviewCardModel[]> {
  const lim = Math.min(24, Math.max(1, limit))
  if (!hasTravelReviewsPublicReadConfig()) {
    if (process.env.NODE_ENV === 'development') console.warn('[reviews] Supabase 미설정')
    return []
  }
  try {
    const supabase = getSupabaseForTravelReviewsPublicRead()
    if (!supabase) return []
    const { data, error } = await supabase
      .from(TABLE)
      .select(cardSelect)
      .eq('category', 'overseas' satisfies ReviewCategory)
      .eq('status', 'published')
      .eq('is_featured', true)
      .order('display_order', { ascending: true })
      .order('displayed_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(lim)

    if (error) {
      console.error('[reviews] getFeaturedOverseasReviews', error.message)
      return []
    }
    return ((data ?? []) as Record<string, unknown>[])
      .map(mapToCard)
      .filter((r) => r.id && r.title && r.excerpt)
  } catch (e) {
    console.error('[reviews] getFeaturedOverseasReviews', e)
    return []
  }
}

/** 호환용 별칭 — 신규 코드는 `getFeaturedOverseasReviews` 사용 권장 */
export async function listFeaturedOverseasReviewCards(limit = 6): Promise<ReviewCardModel[]> {
  return getFeaturedOverseasReviews(limit)
}

export async function insertPendingMemberReview(
  userId: string,
  input: ReviewMemberSubmitInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: '후기 저장소가 설정되지 않았습니다.' }
  }
  if (!userId.trim()) return { ok: false, error: '로그인이 필요합니다.' }

  const tags = input.tags ?? []
  const travelMonth = input.travel_month?.trim() || null
  const displayed_date = derivedDisplayedDateOnSubmit(travelMonth)

  const row = {
    user_id: userId.trim(),
    category: input.category,
    review_type: input.review_type,
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    body: input.body?.trim() || null,
    customer_type: input.customer_type?.trim() || null,
    destination_country: input.destination_country?.trim() || null,
    destination_city: input.destination_city?.trim() || null,
    tags,
    travel_month: travelMonth,
    rating_label: input.rating_label?.trim() || null,
    thumbnail_url: input.thumbnail_url?.trim() || null,
    status: 'pending' as const,
    is_featured: false,
    display_order: 0,
    source_type: 'customer_submitted' as const,
    approved_at: null,
    approved_by: null,
    published_at: null,
    rejection_reason: null,
    displayed_date,
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from(TABLE).insert(row).select('id').single()
    if (error) {
      console.error('[reviews] insert', error.message)
      return { ok: false, error: '후기 저장에 실패했습니다.' }
    }
    const id = (data as { id?: string })?.id
    if (!id) return { ok: false, error: '저장 응답이 올바르지 않습니다.' }
    return { ok: true, id }
  } catch (e) {
    console.error('[reviews] insert', e)
    return { ok: false, error: '후기 저장 중 오류가 발생했습니다.' }
  }
}

export type AdminListParams = {
  status?: ReviewStatus | 'all'
  limit?: number
  offset?: number
}

export async function adminListReviews(params: AdminListParams = {}): Promise<{ rows: ReviewRow[]; error?: string }> {
  if (!hasSupabaseConfig()) return { rows: [], error: 'Supabase 미설정' }
  const limit = Math.min(100, Math.max(1, params.limit ?? 50))
  const offset = Math.max(0, params.offset ?? 0)
  try {
    const supabase = getSupabaseAdmin()
    const st = params.status ?? 'pending'
    let q = supabase.from(TABLE).select('*')
    if (st !== 'all') q = q.eq('status', st)
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    const { data, error } = await q
    if (error) return { rows: [], error: error.message }
    return { rows: (data ?? []) as ReviewRow[] }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export async function adminGetReviewById(id: string): Promise<ReviewRow | null> {
  if (!hasSupabaseConfig() || !id) return null
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
    if (error || !data) return null
    return data as ReviewRow
  } catch {
    return null
  }
}

function resolveDisplayedOnApprove(row: ReviewRow, override?: string | null): string {
  const o = override?.trim().slice(0, 10)
  if (o && o >= '2025-01-07') return o
  const pubDay = new Date().toISOString().slice(0, 10)
  if (row.displayed_date && row.displayed_date >= '2025-01-07') return row.displayed_date.slice(0, 10)
  if (row.travel_month) {
    const tm = row.travel_month.slice(0, 10)
    if (tm.length === 7) return `${tm}-01`
    return tm
  }
  return pubDay
}

export async function adminApproveReview(
  id: string,
  adminUserId: string,
  opts?: { displayed_date?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) return { ok: false, error: 'Supabase 미설정' }
  const row = await adminGetReviewById(id)
  if (!row) return { ok: false, error: '후기를 찾을 수 없습니다.' }
  if (row.status === 'published') return { ok: false, error: '이미 게시된 후기입니다.' }

  const nowIso = new Date().toISOString()
  const displayed = resolveDisplayedOnApprove(row, opts?.displayed_date)
  const adminRef = adminUserId.trim() || 'admin'

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from(TABLE)
      .update({
        status: 'published',
        approved_at: nowIso,
        approved_by: adminRef,
        published_at: nowIso,
        displayed_date: displayed,
        rejection_reason: null,
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function adminRejectReview(
  id: string,
  rejectionReason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) return { ok: false, error: 'Supabase 미설정' }
  const reason = rejectionReason.trim()
  if (!reason) return { ok: false, error: '반려 사유를 입력해 주세요.' }
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function adminArchiveReview(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) return { ok: false, error: 'Supabase 미설정' }
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from(TABLE).update({ status: 'archived' }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function adminFeatureReview(
  id: string,
  input: { is_featured?: boolean; display_order?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) return { ok: false, error: 'Supabase 미설정' }
  const row = await adminGetReviewById(id)
  if (!row) return { ok: false, error: '후기를 찾을 수 없습니다.' }
  if (row.status !== 'published') {
    return { ok: false, error: '게시된 후기만 대표 노출·순서를 설정할 수 있습니다.' }
  }
  const next: Record<string, unknown> = {}
  if (typeof input.is_featured === 'boolean') next.is_featured = input.is_featured
  if (typeof input.display_order === 'number' && Number.isFinite(input.display_order)) {
    next.display_order = Math.floor(input.display_order)
  }
  if (Object.keys(next).length === 0) {
    return { ok: false, error: 'is_featured 또는 display_order 가 필요합니다.' }
  }
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from(TABLE).update(next).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 관리자: 노출일·순서만 수정 (게시 유지) */
const ADMIN_TITLE_MIN = 4
const ADMIN_TITLE_MAX = 200
const ADMIN_EXCERPT_MIN = 10
const ADMIN_EXCERPT_MAX = 800
const ADMIN_BODY_MAX = 20_000

/** 관리자: 제목·요약·본문 수정 (모든 상태에서 가능) */
export async function adminUpdateReviewContent(
  id: string,
  patch: { title?: string; excerpt?: string; body?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) return { ok: false, error: 'Supabase 미설정' }
  const has =
    patch.title !== undefined || patch.excerpt !== undefined || patch.body !== undefined
  if (!has) return { ok: false, error: 'title, excerpt, body 중 하나 이상 필요합니다.' }

  const row = await adminGetReviewById(id)
  if (!row) return { ok: false, error: '후기를 찾을 수 없습니다.' }

  const next: Record<string, unknown> = {}
  if (patch.title !== undefined) {
    const t = patch.title.trim()
    if (t.length < ADMIN_TITLE_MIN) {
      return { ok: false, error: `제목은 ${ADMIN_TITLE_MIN}자 이상 입력해 주세요.` }
    }
    if (t.length > ADMIN_TITLE_MAX) {
      return { ok: false, error: `제목은 ${ADMIN_TITLE_MAX}자 이내입니다.` }
    }
    next.title = t
  }
  if (patch.excerpt !== undefined) {
    const e = patch.excerpt.trim()
    if (e.length < ADMIN_EXCERPT_MIN) {
      return { ok: false, error: `요약은 ${ADMIN_EXCERPT_MIN}자 이상 입력해 주세요.` }
    }
    if (e.length > ADMIN_EXCERPT_MAX) {
      return { ok: false, error: `요약은 ${ADMIN_EXCERPT_MAX}자 이내입니다.` }
    }
    next.excerpt = e
  }
  if (patch.body !== undefined) {
    if (patch.body === null || !String(patch.body).trim()) {
      next.body = null
    } else {
      const b = String(patch.body).trim()
      if (b.length > ADMIN_BODY_MAX) {
        return { ok: false, error: `본문은 ${ADMIN_BODY_MAX}자 이내입니다.` }
      }
      next.body = b
    }
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from(TABLE).update(next).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function adminUpdateReviewModeration(
  id: string,
  patch: { displayed_date?: string | null; display_order?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) return { ok: false, error: 'Supabase 미설정' }
  const row = await adminGetReviewById(id)
  if (!row || row.status !== 'published') {
    return { ok: false, error: '게시된 후기만 수정할 수 있습니다.' }
  }
  const next: Record<string, unknown> = {}
  if (patch.displayed_date !== undefined) {
    if (patch.displayed_date == null || !String(patch.displayed_date).trim()) {
      next.displayed_date = null
    } else {
      const d = String(patch.displayed_date).trim().slice(0, 10)
      if (d < '2025-01-07') return { ok: false, error: '노출일은 2025-01-07 이후여야 합니다.' }
      next.displayed_date = d
    }
  }
  if (typeof patch.display_order === 'number' && Number.isFinite(patch.display_order)) {
    next.display_order = Math.floor(patch.display_order)
  }
  if (Object.keys(next).length === 0) return { ok: false, error: '변경할 값이 없습니다.' }
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from(TABLE).update(next).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
