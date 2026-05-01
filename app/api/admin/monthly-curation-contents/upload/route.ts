import { NextResponse } from 'next/server'
import { resolveAdminUploadedImageMime } from '@/lib/admin-upload-image-mime'
import { requireAdmin } from '@/lib/require-admin'
import { saveMonthlyCurationImage } from '@/lib/monthly-curation-image'

const MAX_FILE_BYTES = 30 * 1024 * 1024

/**
 * 서버 경유 업로드 — 시즌 추천 이미지의 기본 경로.
 * `saveMonthlyCurationImage` → `uploadStorageObject`에서 sharp로 리사이즈·WebP 변환(버킷 정책과 동일).
 * 대용량 시 nginx `client_max_body_size` 등 본문 한도를 맞춰야 한다.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 })
    }
    const resolvedMime = resolveAdminUploadedImageMime(file)
    if (!resolvedMime) {
      return NextResponse.json(
        {
          error:
            'jpg/png/webp만 업로드할 수 있습니다. 파일 확장자·형식을 확인하세요. (일부 PC에서는 MIME이 비어 있을 수 있어 확장자로 판별합니다.)',
        },
        { status: 400 },
      )
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: '파일 크기는 30MB 이하여야 합니다.' }, { status: 400 })
    }

    const monthKey = String(form.get('monthKey') ?? '').trim()
    const title = String(form.get('title') ?? '').trim()
    const saved = await saveMonthlyCurationImage(file, { monthKey, title })
    return NextResponse.json({ ok: true, ...saved })
  } catch (e) {
    console.error('[monthly-curation upload]', e)
    const msg = e instanceof Error ? e.message : String(e)
    const lower = msg.toLowerCase()
    if (
      lower.includes('supabase') ||
      lower.includes('storage') ||
      lower.includes('설정되지') ||
      lower.includes('service_role')
    ) {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    return NextResponse.json({ error: msg || '업로드 실패' }, { status: 500 })
  }
}

