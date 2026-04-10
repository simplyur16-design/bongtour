/**
 * Supabase Admin 클라이언트 (서버 전용 service role).
 * travel_reviews 등 Postgres 테이블 접근용.
 * 이미지 바이너리는 Supabase Storage(lib/object-storage.ts) + Prisma image_assets 메타.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

function requireServerSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim()
  if (!url) {
    throw new Error('SUPABASE_URL 이 필요합니다.')
  }
  return url
}

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. (서버 전용, 브라우저에 노출 금지)')
  }
  return key
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = requireServerSupabaseUrl()
  const key = requireServiceRoleKey()
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}
