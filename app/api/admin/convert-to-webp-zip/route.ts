import { NextResponse } from 'next/server'
import archiver from 'archiver'
import { requireAdmin } from '@/lib/require-admin'
import { convertToWebp } from '@/lib/image-to-webp'
import { buildWebpFilename, inferSourceFromFilename } from '@/lib/webp-filename'

const MAX_FILES = 50
const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30MB each
const ZIP_NAME = 'Travel_Photos_Final.zip'
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function hasAllowedExt(name: string): boolean {
  const lower = name.toLowerCase()
  return Array.from(ALLOWED_EXTENSIONS).some((ext) => lower.endsWith(ext))
}

type FileWithMeta = { file: File; cityName: string; attractionName: string; source: string }

/**
 * POST /api/admin/convert-to-webp-zip. 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const formData = await request.formData()
    const files: FileWithMeta[] = []

    const fileList = formData.getAll('file').filter((f): f is File => f instanceof File)
    if (fileList.length === 0) {
      const f = formData.get('file')
      if (f instanceof File) fileList.push(f)
    }
    if (fileList.length === 0) {
      return NextResponse.json({ error: 'file(들)을 넣어 주세요.' }, { status: 400 })
    }
    if (fileList.length > MAX_FILES) {
      return NextResponse.json({ error: `최대 ${MAX_FILES}개까지 가능합니다.` }, { status: 400 })
    }

    const cityRaw = formData.get('cityName') ?? formData.get('cityNames')
    const attractionRaw = formData.get('attractionName') ?? formData.get('attractionNames')
    const sourceRaw = formData.get('source') ?? formData.get('sources')

    const cityArr = parseList(cityRaw, fileList.length, 'City')
    const attractionArr = parseList(attractionRaw, fileList.length, 'Landmark')
    const sourceArr = parseList(sourceRaw, fileList.length, 'Upload')

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
      const userSource = (sourceArr[i] ?? '').trim()
      const source = userSource || inferSourceFromFilename(file.name) || 'Upload'
      files.push({
        file,
        cityName: cityArr[i] ?? 'City',
        attractionName: attractionArr[i] ?? 'Landmark',
        source,
      })
    }

    const archive = archiver('zip', { zlib: { level: 6 } })
    const chunks: Buffer[] = []
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve())
      archive.on('error', reject)
    })

    for (let i = 0; i < files.length; i++) {
      const { file, cityName, attractionName, source } = files[i]
      const inputBuffer = Buffer.from(await file.arrayBuffer())
      const { buffer } = await convertToWebp(inputBuffer, { maxWidth: 1600, quality: 82 })
      const name = buildWebpFilename(cityName, attractionName, source)
      archive.append(buffer, { name })
    }

    archive.finalize()
    await done

    const zipBuffer = Buffer.concat(chunks)
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(ZIP_NAME)}"`,
      },
    })
  } catch (e) {
    console.error('convert-to-webp-zip:', e)
    return NextResponse.json({ error: 'ZIP 생성 실패' }, { status: 500 })
  }
}

function parseList(value: FormDataEntryValue | null, length: number, defaultVal: string): string[] {
  if (value == null) return Array(length).fill(defaultVal)
  const s = String(value).trim()
  const parts = s.includes(',') ? s.split(',').map((x) => x.trim()) : [s]
  const out: string[] = []
  for (let i = 0; i < length; i++) {
    out.push(parts[i] ?? parts[parts.length - 1] ?? defaultVal)
  }
  return out
}
