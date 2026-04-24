import { randomUUID } from 'crypto'
import {
  PRIVATE_TRIP_HERO_STORAGE_PREFIX,
  PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES,
} from '@/lib/private-trip-hero-constants'
import { processPrivateTripHeroImageToWebpCover, saveProcessedPrivateTripHeroWebp } from '@/lib/private-trip-hero-upload'
import { getSupabaseImageStorageBucket, isSupabaseStorageAdminConfigured } from '@/lib/object-storage'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

const INCOMING = `${PRIVATE_TRIP_HERO_STORAGE_PREFIX}/incoming`

async function removeSupabaseIncomingKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const supabase = getSupabaseAdmin()
  const bucket = getSupabaseImageStorageBucket()
  const { error } = await supabase.storage.from(bucket).remove(keys)
  if (error) throw new Error(error.message)
}

/**
 * 브라우저 `createClient`용 — **anon 공개 키만**(service role 금지).
 * `NEXT_PUBLIC_*` 없이 서버 env만 써도 되게: `SUPABASE_URL` + `SUPABASE_ANON_KEY` 조합 허용.
 */
export function getPrivateTripHeroBrowserSupabaseClientConfig(): {
  supabaseUrl: string
  anonKey: string
} | null {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim()
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '').trim()
  if (!supabaseUrl || !anonKey) return null
  return { supabaseUrl, anonKey }
}

/** 직접 업로드 경로를 켤 수 있는지(폴더 API·관리자 UI 플래그) */
export function isPrivateTripHeroDirectBrowserUploadConfigured(): boolean {
  return getPrivateTripHeroBrowserSupabaseClientConfig() !== null
}

const ALLOWED_SIGN_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
])

function extForMime(mime: string): string {
  const m = mime.toLowerCase().split(';')[0]!.trim()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  if (m === 'image/avif') return 'avif'
  if (m === 'image/heic' || m === 'image/heif') return 'heic'
  return 'bin'
}

/** `private-trip-hero/incoming/<id>.<ext>` — 경로 조작 방지 */
const INCOMING_PATH = /^private-trip-hero\/incoming\/[^/]+\.[a-z0-9]+$/i

/**
 * 관리자 전용: 임시 incoming 객체에 대한 signed upload URL 발급.
 */
export async function signPrivateTripHeroIncomingUpload(params: {
  byteLength: number
  mimeType: string
}): Promise<{ incomingPath: string; token: string }> {
  if (!isSupabaseStorageAdminConfigured()) {
    throw new Error('Supabase Storage(서비스 롤)가 설정되어 있지 않습니다.')
  }
  if (params.byteLength <= 0 || params.byteLength > PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES) {
    throw new Error(`파일은 ${Math.round(PRIVATE_TRIP_HERO_UPLOAD_MAX_BYTES / 1024 / 1024)}MB 이하여야 합니다.`)
  }

  const mime = (params.mimeType || '').toLowerCase().split(';')[0]!.trim()
  if (!mime || !ALLOWED_SIGN_MIME.has(mime)) {
    throw new Error('jpg, png, webp, gif, avif, heic 등 이미지 형식만 업로드할 수 있습니다.')
  }

  const id = randomUUID()
  const ext = extForMime(params.mimeType || 'application/octet-stream')
  const incomingPath = `${INCOMING}/${id}.${ext}`

  const supabase = getSupabaseAdmin()
  const bucket = getSupabaseImageStorageBucket()
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(incomingPath, { upsert: true })
  if (error || !data?.token) {
    throw new Error(error?.message || 'signed URL 생성 실패')
  }

  return { incomingPath, token: data.token }
}

/**
 * incoming에 올라간 원본을 받아 WebP로 변환·최종 키에 저장한 뒤 incoming을 삭제한다.
 */
export async function finalizePrivateTripHeroIncomingUpload(incomingPath: string, originalFileName: string): Promise<{
  fileName: string
  publicUrl: string
  bytesWritten: number
}> {
  if (!INCOMING_PATH.test(incomingPath)) {
    throw new Error('잘못된 incoming 경로입니다.')
  }

  const supabase = getSupabaseAdmin()
  const bucket = getSupabaseImageStorageBucket()
  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(incomingPath)
  if (dlErr || !blob) {
    throw new Error(dlErr?.message || '임시 파일을 읽지 못했습니다.')
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error('빈 파일입니다.')
  }

  let webp: Buffer
  try {
    webp = await processPrivateTripHeroImageToWebpCover(buffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await removeSupabaseIncomingKeys([incomingPath]).catch(() => {})
    throw new Error(`이미지 처리 실패: ${msg}`)
  }

  const saved = await saveProcessedPrivateTripHeroWebp(webp, originalFileName || 'upload')
  await removeSupabaseIncomingKeys([incomingPath]).catch((err) => {
    console.warn('[private-trip-hero] incoming 삭제 실패(무시 가능):', incomingPath, err)
  })

  return saved
}
