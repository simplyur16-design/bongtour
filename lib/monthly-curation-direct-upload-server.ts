/**
 * @deprecated 2026-04-22 — signed upload(createSignedUploadUrl) 폐기.
 * 시즌 추천 이미지는 `POST /api/admin/monthly-curation-contents/upload` + `uploadStorageObject`(sharp WebP)로 통일.
 * 이 모듈은 롤백·참고용으로 유지한다. (`signed-upload` 라우트는 410 Gone.)
 */
import { buildMonthlyCurationWebpObjectKey } from '@/lib/monthly-curation-object-key'
import {
  buildPublicUrlForObjectKey,
  getImageStorageBucket,
  isObjectStorageConfigured,
} from '@/lib/object-storage'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const MAX_BYTES = 30 * 1024 * 1024

/**
 * 브라우저 `createClient`용 — **anon 공개 키만**(service role 금지).
 * `NEXT_PUBLIC_*` 없이 서버 env만 써도 되게: `SUPABASE_URL` + `SUPABASE_ANON_KEY` 조합 허용.
 */
export function getMonthlyCurationBrowserSupabaseClientConfig(): { supabaseUrl: string; anonKey: string } | null {
  if (!isObjectStorageConfigured()) return null
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '').trim()
  if (!supabaseUrl || !anonKey) return null
  return { supabaseUrl, anonKey }
}

export function isMonthlyCurationDirectBrowserUploadConfigured(): boolean {
  return getMonthlyCurationBrowserSupabaseClientConfig() !== null
}

/**
 * 관리자 전용: `monthly-curation/…` WebP 객체에 대한 signed upload 토큰 발급(nginx 본문 한도 회피).
 * 경로는 서버에서만 생성한다.
 */
export async function signMonthlyCurationWebpDirectUpload(params: {
  monthKey: string
  title: string
  byteLength: number
  contentType: string
}): Promise<{
  objectKey: string
  token: string
  imageUrl: string
  imageStorageKey: string
}> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Supabase Storage가 설정되어 있지 않습니다.')
  }
  const ct = (params.contentType || '').toLowerCase().split(';')[0]!.trim()
  if (ct !== 'image/webp') {
    throw new Error('직접 업로드는 image/webp만 허용됩니다. 브라우저에서 WebP로 변환한 뒤 요청하세요.')
  }
  if (params.byteLength <= 0 || params.byteLength > MAX_BYTES) {
    throw new Error(`파일은 ${Math.round(MAX_BYTES / 1024 / 1024)}MB 이하여야 합니다.`)
  }

  const objectKey = buildMonthlyCurationWebpObjectKey({
    monthKey: params.monthKey,
    title: params.title,
  })
  if (!objectKey.startsWith('monthly-curation/')) {
    throw new Error('잘못된 저장 경로입니다.')
  }

  const supabase = getSupabaseAdmin()
  const bucket = getImageStorageBucket()
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectKey, { upsert: true })
  if (error || !data?.token) {
    throw new Error(error?.message || 'signed URL 생성 실패')
  }

  return {
    objectKey,
    token: data.token,
    imageUrl: buildPublicUrlForObjectKey(objectKey),
    imageStorageKey: objectKey,
  }
}
