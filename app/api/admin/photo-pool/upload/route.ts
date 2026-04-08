import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { savePhotoToPool } from '@/lib/photo-pool'
import { inferSourceFromFilename } from '@/lib/webp-filename'

const MAX_FILES = 50
const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30MB each
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function hasAllowedExt(name: string): boolean {
  const lower = name.toLowerCase()
  return Array.from(ALLOWED_EXTENSIONS).some((ext) => lower.endsWith(ext))
}

function parseList(val: FormDataEntryValue | null, length: number, defaultVal: string): string[] {
  if (val == null) return Array(length).fill(defaultVal)
  const s = String(val).trim()
  const parts = s.includes(',') ? s.split(',').map((x) => x.trim()) : [s]
  const out: string[] = []
  for (let i = 0; i < length; i++) {
    out.push(parts[i] ?? parts[parts.length - 1] ?? defaultVal)
  }
  return out
}

/**
 * POST /api/admin/photo-pool/upload. 인증: 관리자.
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

    const cityArr = parseList(formData.get('cityName') ?? formData.get('cityNames'), fileList.length, 'City')
    const attractionArr = parseList(formData.get('attractionName') ?? formData.get('attractionNames'), fileList.length, 'Landmark')
    const sourceArr = parseList(formData.get('source') ?? formData.get('sources'), fileList.length, 'Upload')

    const saved: { id: string; filePath: string }[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const mime = (file.type || '').toLowerCase()
      if (!ALLOWED_IMAGE_MIME.has(mime)) {
        return NextResponse.json({ error: `파일 ${i + 1}: jpg/png/webp만 허용됩니다.` }, { status: 400 })
      }
      if (!hasAllowedExt(file.name || '')) {
        return NextResponse.json({ error: `파일 ${i + 1}: 확장자는 .jpg/.jpeg/.png/.webp만 허용됩니다.` }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `파일 ${i + 1} 크기는 30MB 이하여야 합니다.` }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const city = cityArr[i] ?? 'City'
      const attraction = attractionArr[i] ?? 'Landmark'
      const userSource = (sourceArr[i] ?? '').trim()
      const source = userSource || inferSourceFromFilename(file.name) || 'Upload'
      const row = await savePhotoToPool(prisma, buffer, city, attraction, source, {
        convertToWebpFirst: true,
        maxWidth: 1600,
        quality: 82,
      })
      saved.push({ id: row.id, filePath: row.filePath })
    }

    return NextResponse.json({ ok: true, saved: saved.length, items: saved })
  } catch (e) {
    console.error('photo-pool/upload:', e)
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Ncloud')) {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
