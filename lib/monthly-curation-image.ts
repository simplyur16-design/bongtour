import { convertToWebp } from '@/lib/image-to-webp'
import {
  buildEditorialObjectKey,
  buildMonthlyCurationObjectKey,
  isObjectStorageConfigured,
  uploadStorageObject,
} from '@/lib/object-storage'

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .slice(0, 80)
}

function requireObjectStorage(): void {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      'Supabase Storage가 설정되지 않았습니다. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, 선택 SUPABASE_IMAGE_BUCKET을 설정하세요.'
    )
  }
}

export async function saveMonthlyCurationImage(file: File, opts: { monthKey: string; title: string }) {
  requireObjectStorage()
  const input = Buffer.from(await file.arrayBuffer())
  const converted = await convertToWebp(input, { maxWidth: 1600, quality: 82 })
  const filename = `${slug(opts.monthKey || 'month')}-${slug(opts.title || 'curation')}-${Date.now()}.webp`
  const objectKey = buildMonthlyCurationObjectKey(filename)
  const { publicUrl } = await uploadStorageObject({
    objectKey,
    body: converted.buffer,
    contentType: 'image/webp',
  })
  return {
    imageUrl: publicUrl,
    imageStorageKey: objectKey,
    imageWidth: converted.width,
    imageHeight: converted.height,
  }
}

export async function saveEditorialHeroImage(file: File, opts: { title: string }) {
  requireObjectStorage()
  const input = Buffer.from(await file.arrayBuffer())
  const converted = await convertToWebp(input, { maxWidth: 1600, quality: 82 })
  const filename = `editorial-${slug(opts.title || 'hero')}-${Date.now()}.webp`
  const objectKey = buildEditorialObjectKey(filename)
  const { publicUrl } = await uploadStorageObject({
    objectKey,
    body: converted.buffer,
    contentType: 'image/webp',
  })
  return {
    heroImageUrl: publicUrl,
    heroImageStorageKey: objectKey,
    heroImageWidth: converted.width,
    heroImageHeight: converted.height,
  }
}
