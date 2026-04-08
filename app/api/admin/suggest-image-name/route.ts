import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { suggestImageName } from '@/lib/suggest-image-name'

const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30MB

/**
 * POST /api/admin/suggest-image-name. 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file 필드에 이미지 파일을 넣어 주세요.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: '파일 크기는 30MB 이하여야 합니다.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

    const result = await suggestImageName(buffer, mime)
    return NextResponse.json(result)
  } catch (e) {
    console.error('suggest-image-name:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
