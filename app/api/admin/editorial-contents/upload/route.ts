import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { saveEditorialHeroImage } from '@/lib/monthly-curation-image'

const MAX_FILE_BYTES = 30 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'jpg/png/webp 파일만 업로드할 수 있습니다.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: '파일 크기는 30MB 이하여야 합니다.' }, { status: 400 })
    }

    const title = String(form.get('title') ?? '').trim()
    const saved = await saveEditorialHeroImage(file, { title })
    return NextResponse.json({ ok: true, ...saved })
  } catch (e) {
    console.error('[editorial-content upload]', e)
    const msg = e instanceof Error ? e.message : ''
    if ((msg.includes('Supabase') || msg.includes('Storage'))) {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 })
  }
}
