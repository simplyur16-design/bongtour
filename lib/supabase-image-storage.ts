/**
 * Supabase Storage + Postgres (서버 전용 service role).
 * SUPABASE_SERVICE_ROLE_KEY 는 서버에서만 사용하고 클라이언트 번들에 넣지 않는다.
 * 공개 URL 조합 규칙: lib/image-asset-naming.ts · lib/image-asset-ssot.ts 의 buildSupabasePublicObjectUrl.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

function requireServerSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim()
  if (!url) {
    throw new Error('SUPABASE_URL 이 필요합니다. (예: https://xxxx.supabase.co)')
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

/** Storage 업로드·Postgres(image_assets)·관리자 API 전용. service role 만 사용. */
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

/** 공개 객체 URL 조합용 프로젝트 origin (signed URL 사용 안 함). */
export function getSupabaseProjectPublicUrl(): string {
  return requireServerSupabaseUrl()
}

export type UploadPublicObjectResult = {
  path: string
  bucket: string
}

/**
 * 공개 버킷에 객체 업로드. upsert=false 로 동일 경로 실패 시 상위에서 seq 재시도.
 */
export async function uploadPublicImage(params: {
  bucket: string
  path: string
  body: Buffer
  contentType: string
  upsert?: boolean
}): Promise<UploadPublicObjectResult> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(params.bucket).upload(params.path, params.body, {
    contentType: params.contentType,
    upsert: params.upsert ?? false,
  })
  if (error) {
    throw new Error(`Storage 업로드 실패: ${error.message}`)
  }
  return { path: params.path, bucket: params.bucket }
}

/** DB 저장 실패 시 Storage 고아 객체 제거용 */
export async function removePublicObject(bucket: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(bucket).remove([storagePath])
  if (error) {
    console.error('[supabase-storage] remove failed', storagePath, error.message)
  }
}
