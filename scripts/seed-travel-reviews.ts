/**
 * public.travel_reviews 관리자 시드 삽입/갱신 (service role).
 *
 * 실행 (저장소 루트, .env.local 에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   npx tsx scripts/seed-travel-reviews.ts
 * 또는:
 *   npm run seed:travel-reviews
 *
 * 중복 방지: 새 컬럼 없이 자연키
 *   title + displayed_date + destination_country + destination_city
 * 조합이 같으면 UPDATE, 없으면 INSERT.
 * (동일 조합의 회원 후기가 이미 있으면 덮어쓰므로, 운영 DB에서는 시드 제목·일자·목적지를 유니크하게 유지할 것.)
 *
 * 재실행 검증: 동일 DB에서 2회 연속 실행 시 1회차는 insert 위주, 2회차는 update 21·insert 0 이어야
 * 행 수가 늘지 않습니다. (배열 검증만: npm run verify:travel-review-seed)
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '../lib/supabase-image-storage'
import {
  assertTravelReviewSeedInvariants,
  TRAVEL_REVIEW_SEED_ITEMS,
  type TravelReviewSeedItem,
} from './data/travel-review-seed-data'

const TABLE = 'travel_reviews'

/** DB 가 user_id / approved_by 를 uuid 로 두는 경우 대비 — 형식 유효한 고정 UUID(실제 User 행 없음) */
const SEED_ACTOR_ID = '11111111-1111-1111-1111-111111111111'

function loadEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const p = join(process.cwd(), name)
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
    break
  }
}

function naturalKey(item: TravelReviewSeedItem): string {
  const title = item.title.trim()
  const d = item.displayed_date.trim().slice(0, 10)
  const c = item.destination_country?.trim() ?? ''
  const city = item.destination_city?.trim() ?? ''
  return `${title}|${d}|${c}|${city}`
}

function publishedAtIso(displayedDate: string): string {
  const d = displayedDate.trim().slice(0, 10)
  return `${d}T12:00:00.000Z`
}

function buildRow(
  item: TravelReviewSeedItem,
  featuredDisplayOrder: number
): Record<string, unknown> {
  const published = item.status === 'published'
  const isFeatured = published && item.is_featured
  const displayed = item.displayed_date.trim().slice(0, 10)
  const pubAt = published ? publishedAtIso(displayed) : null
  const apprAt = published ? pubAt : null

  return {
    user_id: SEED_ACTOR_ID,
    category: 'overseas',
    review_type: item.review_type,
    title: item.title.trim(),
    excerpt: item.excerpt.trim(),
    body: item.body.trim(),
    customer_type: item.customer_type.trim(),
    destination_country: item.destination_country?.trim() || null,
    destination_city: item.destination_city?.trim() || null,
    tags: item.tags,
    travel_month: item.travel_month.trim().slice(0, 10),
    displayed_date: displayed,
    rating_label: item.rating_label?.trim() || null,
    thumbnail_url: null,
    is_featured: isFeatured,
    display_order: isFeatured ? featuredDisplayOrder : 0,
    status: item.status,
    rejection_reason:
      item.status === 'rejected' ? (item.rejection_reason?.trim() ?? '반려') : null,
    source_type: 'manual_admin',
    approved_at: apprAt,
    approved_by: published ? SEED_ACTOR_ID : null,
    published_at: pubAt,
  }
}

async function findIdByNaturalKey(
  supabase: SupabaseClient,
  item: TravelReviewSeedItem
): Promise<string | null> {
  const title = item.title.trim()
  const d = item.displayed_date.trim().slice(0, 10)
  const c = item.destination_country?.trim() ?? null
  const city = item.destination_city?.trim() ?? null

  let q = supabase.from(TABLE).select('id').eq('title', title).eq('displayed_date', d)
  if (c == null) q = q.is('destination_country', null)
  else q = q.eq('destination_country', c)
  if (city == null) q = q.is('destination_city', null)
  else q = q.eq('destination_city', city)

  const { data, error } = await q.limit(2)
  if (error) {
    console.error('[seed-travel-reviews] lookup', error.message)
    return null
  }
  const rows = (data ?? []) as { id: string }[]
  if (rows.length === 0) return null
  if (rows.length > 1) {
    console.warn(
      '[seed-travel-reviews] 동일 자연키 다건 — 첫 행만 갱신합니다:',
      title.slice(0, 40)
    )
  }
  return rows[0].id
}

async function main() {
  assertTravelReviewSeedInvariants()

  loadEnvLocal()

  const featuredOrders = new Map<string, number>()
  let rank = 0
  for (const item of TRAVEL_REVIEW_SEED_ITEMS) {
    if (item.is_featured && item.status === 'published') {
      rank++
      featuredOrders.set(naturalKey(item), rank)
    }
  }
  if (rank !== 6) {
    throw new Error(`[seed-travel-reviews] 피처드 published 는 정확히 6건이어야 합니다. 현재: ${rank}`)
  }

  if (TRAVEL_REVIEW_SEED_ITEMS.length !== 21) {
    throw new Error(
      `[seed-travel-reviews] 시드는 21건이어야 합니다. 현재: ${TRAVEL_REVIEW_SEED_ITEMS.length}`
    )
  }

  const supabase = getSupabaseAdmin()
  let inserted = 0
  let updated = 0
  let failed = 0

  function logDbError(op: 'insert' | 'update', title: string, message: string) {
    const hint =
      /uuid/i.test(message) || /invalid input syntax/i.test(message)
        ? ' (hint: user_id / approved_by 등 uuid 컬럼에 비-UUID 문자열이 없는지 확인)'
        : ''
    console.error(`[seed-travel-reviews] ${op} failed`, title.slice(0, 56), message + hint)
  }

  for (const item of TRAVEL_REVIEW_SEED_ITEMS) {
    const key = naturalKey(item)
    const fo = item.is_featured && item.status === 'published' ? featuredOrders.get(key) ?? 0 : 0
    if (item.is_featured && item.status === 'published' && (!fo || fo < 1 || fo > 6)) {
      throw new Error(`[seed-travel-reviews] 피처드 순서 누락: ${item.title.slice(0, 40)}`)
    }
    const row = buildRow(item, fo)

    const existingId = await findIdByNaturalKey(supabase, item)
    if (existingId) {
      const { error } = await supabase.from(TABLE).update(row).eq('id', existingId)
      if (error) {
        failed++
        logDbError('update', item.title, error.message)
        continue
      }
      updated++
      console.log(`[update] ${item.title.slice(0, 48)}…`)
    } else {
      const { error } = await supabase.from(TABLE).insert(row)
      if (error) {
        failed++
        logDbError('insert', item.title, error.message)
        continue
      }
      inserted++
      console.log(`[insert] ${item.title.slice(0, 48)}…`)
    }
  }

  console.log('')
  console.log('[seed-travel-reviews] 요약:', { inserted, updated, failed, total: TRAVEL_REVIEW_SEED_ITEMS.length })
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
