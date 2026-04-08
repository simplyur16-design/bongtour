import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { convertToWebp } from '@/lib/image-to-webp'
import { buildWebpFilename, inferSourceFromFilename } from '@/lib/webp-filename'

const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30MB
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function hasAllowedExt(name: string): boolean {
  const lower = name.toLowerCase()
  return Array.from(ALLOWED_EXTENSIONS).some((ext) => lower.endsWith(ext))
}

/**
 * POST /api/admin/convert-to-webp. 인증: 관리자.
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
    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      return NextResponse.json({ error: 'jpg/png/webp 파일만 허용됩니다.' }, { status: 400 })
    }
    if (!hasAllowedExt(file.name || '')) {
      return NextResponse.json({ error: '확장자는 .jpg/.jpeg/.png/.webp만 허용됩니다.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: '파일 크기는 30MB 이하여야 합니다.' }, { status: 400 })
    }

    const cityName = String(formData.get('cityName') ?? '').trim()
    const attractionName = String(formData.get('attractionName') ?? '').trim()
    const userSource = String(formData.get('source') ?? '').trim()
    const source = userSource || inferSourceFromFilename(file.name) || 'Upload'

    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)
    const originalSizeBytes = inputBuffer.length

    const maxWidth = formData.get('maxWidth')
    const quality = formData.get('quality')
    const result = await convertToWebp(inputBuffer, {
      maxWidth: maxWidth ? parseInt(String(maxWidth), 10) : undefined,
      quality: quality ? parseInt(String(quality), 10) : undefined,
    })

    const download = new URL(request.url).searchParams.get('download') === '1'
    const filename = buildWebpFilename(cityName || 'City', attractionName || 'Landmark', source || 'Upload')

    if (download) {
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          'Content-Type': 'image/webp',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'X-Original-Bytes': String(originalSizeBytes),
          'X-WebP-Bytes': String(result.buffer.length),
        },
      })
    }

    const base64 = result.buffer.toString('base64')
    return NextResponse.json({
      ok: true,
      filename,
      base64,
      dataUrl: `data:image/webp;base64,${base64}`,
      sizeBytes: result.buffer.length,
      width: result.width,
      height: result.height,
      originalSizeBytes,
    })
  } catch (e) {
    console.error('convert-to-webp:', e)
    return NextResponse.json({ error: '변환 실패' }, { status: 500 })
  }
}
