import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { savePhotoToPool } from '@/lib/photo-pool'
import { suggestImageName } from '@/lib/suggest-image-name'
import { inferSourceFromFilename } from '@/lib/webp-filename'

const MAX_FILES = 50
const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30MB each

/** 사진마다 제미나이 호출하므로 시간 여유 */
export const maxDuration = 120

/**
 * POST /api/admin/photo-pool/batch-with-suggest. 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const formData = await request.formData()
    const fileList = formData.getAll('file').filter((f): f is File => f instanceof File)
    if (fileList.length === 0) {
      const f = formData.get('file')
      if (f instanceof File) fileList.push(f)
    }
    if (fileList.length === 0) {
      return NextResponse.json({ error: '이미지 파일을 넣어 주세요.' }, { status: 400 })
    }
    if (fileList.length > MAX_FILES) {
      return NextResponse.json({ error: `한 번에 최대 ${MAX_FILES}장까지 가능합니다.` }, { status: 400 })
    }

    const saved: { id: string; filePath: string; city: string; attraction: string; source: string }[] = []
    const errors: { index: number; message: string }[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (file.size > MAX_FILE_BYTES) {
        errors.push({ index: i + 1, message: '30MB 초과' })
        continue
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        const { city, attraction } = await suggestImageName(buffer, mime)
        const source = inferSourceFromFilename(file.name) || 'Upload'
        const row = await savePhotoToPool(prisma, buffer, city, attraction, source, {
          convertToWebpFirst: true,
          maxWidth: 1600,
          quality: 82,
        })
        saved.push({
          id: row.id,
          filePath: row.filePath,
          city,
          attraction,
          source,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : '저장 실패'
        console.warn(`photo-pool/batch-with-suggest 파일 ${i + 1} 실패:`, msg)
        errors.push({ index: i + 1, message: msg })
      }
    }

    return NextResponse.json({
      ok: true,
      saved: saved.length,
      failed: errors.length,
      items: saved,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e) {
    console.error('photo-pool/batch-with-suggest:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
