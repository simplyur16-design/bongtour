import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  buildPublicUrlForObjectKey,
  isObjectStorageConfigured,
  listStorageObjectKeysRecursive,
} from '@/lib/object-storage'

const IMAGE_KEY_RE = /\.(webp|png|jpe?g|gif|avif)$/i

function isSafeStoragePrefix(p: string): boolean {
  const t = p.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (t.length === 0 || t.length > 240) return false
  if (t.includes('..')) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(t)
}

function parseLimit(raw: string | null, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(2000, Math.floor(n))
}

/**
 * Supabase Storage 공개 객체 목록(관리자 이미지 피커용).
 * GET ?prefix=photo-pool&limit=500 — 반환 `publicUrl`은 기존 홈허브·모바일 타일 저장과 동일 포맷(https 공개 URL).
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  if (!isObjectStorageConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Supabase Storage(SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const prefixRaw = (searchParams.get('prefix') ?? 'photo-pool').trim()
  if (!isSafeStoragePrefix(prefixRaw)) {
    return NextResponse.json({ ok: false, error: '허용되지 않는 prefix 형식입니다.' }, { status: 400 })
  }
  const prefix = prefixRaw.replace(/^\/+/, '').replace(/\/+$/, '')
  const maxKeys = parseLimit(searchParams.get('limit'), 600)

  try {
    const { objects, truncated } = await listStorageObjectKeysRecursive({
      prefix,
      maxKeys,
      maxDepth: 28,
    })

    const imageObjects = objects.filter((o) => IMAGE_KEY_RE.test(o.objectKey) && !o.objectKey.endsWith('/.keep'))

    const items = imageObjects.map((o) => ({
      objectKey: o.objectKey,
      publicUrl: buildPublicUrlForObjectKey(o.objectKey),
      updated_at: o.updated_at ?? o.created_at ?? null,
    }))

    items.sort((a, b) => {
      const ta = Date.parse(a.updated_at ?? '') || 0
      const tb = Date.parse(b.updated_at ?? '') || 0
      return tb - ta
    })

    return NextResponse.json({
      ok: true,
      prefix,
      truncated,
      count: items.length,
      items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '목록 조회에 실패했습니다.'
    console.error('[storage-image-picker]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
