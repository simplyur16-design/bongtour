import { convertToWebp } from '@/lib/image-to-webp'
import {
  buildEditorialObjectKey,
  buildMonthlyCurationObjectKey,
  isNcloudObjectStorageConfigured,
  uploadNcloudObject,
} from '@/lib/ncloud-object-storage'

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '')
    .slice(0, 80)
}

function requireNcloud(): void {
  if (!isNcloudObjectStorageConfigured()) {
    throw new Error(
      'Ncloud Object Storage가 설정되지 않았습니다. NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_REGION, NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL 등을 설정하세요.'
    )
  }
}

export async function saveMonthlyCurationImage(file: File, opts: { monthKey: string; title: string }) {
  requireNcloud()
  const input = Buffer.from(await file.arrayBuffer())
  const converted = await convertToWebp(input, { maxWidth: 1600, quality: 82 })
  const filename = `${slug(opts.monthKey || 'month')}-${slug(opts.title || 'curation')}-${Date.now()}.webp`
  const objectKey = buildMonthlyCurationObjectKey(filename)
  const { publicUrl } = await uploadNcloudObject({
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
  requireNcloud()
  const input = Buffer.from(await file.arrayBuffer())
  const converted = await convertToWebp(input, { maxWidth: 1600, quality: 82 })
  const filename = `editorial-${slug(opts.title || 'hero')}-${Date.now()}.webp`
  const objectKey = buildEditorialObjectKey(filename)
  const { publicUrl } = await uploadNcloudObject({
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
