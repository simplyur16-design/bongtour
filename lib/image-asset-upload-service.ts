/**
 * 이미지 업로드: Storage → public_url → public.image_assets (서비스 롤 전용).
 * Google Sheet 연동 없음.
 */

import { randomUUID } from 'crypto'
import { convertToWebp } from '@/lib/image-to-webp'
import {
  assertEntityType,
  assertImageRole,
  assertServiceType,
} from '@/lib/image-asset-ssot'
import { prepareOperationalImageAsset } from '@/lib/image-asset-naming'
import type { ImageAssetRow } from '@/lib/supabase-image-assets-db'
import { clearPrimaryForEntity, findImageAssetById, insertImageAssetRow, updateImageAssetById } from '@/lib/supabase-image-assets-db'
import {
  detectImageSourceTypeFromFilename,
  isGeneratedImageSourceType,
  parseOptionalImageSourceType,
  resolveImageAssetSource,
  sourceTypeToSourceName,
  type ImageSourceType,
} from '@/lib/image-asset-source'
import { IMAGE_ASSET_STORAGE_BUCKET } from '@/lib/image-asset-ssot'
import { getSupabaseProjectPublicUrl, removePublicObject, uploadPublicImage } from '@/lib/supabase-image-storage'

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024

export type ImageAssetUploadInput = {
  entityType: string
  entityId: string
  entityNameKr: string
  entityNameEn?: string | null
  supplierName?: string | null
  serviceType: string
  imageRole: string
  isPrimary: boolean
  sortOrder: number
  uploadedBy?: string | null
  groupKey?: string | null
  /** 원본 업로드 파일명 (source 판별용) */
  originalFileName: string
  sourceType?: string | null
  sourceNote?: string | null
  isGeminiAuto?: boolean
  isPexelsAuto?: boolean
  titleKr?: string | null
  titleEn?: string | null
  seoTitleKr?: string | null
  seoTitleEn?: string | null
  fileBuffer: Buffer
  originalMime: string
}

export async function runImageAssetUpload(input: ImageAssetUploadInput): Promise<{
  ok: true
  asset: ImageAssetRow
}> {
  const entityType = assertEntityType(input.entityType)
  const serviceType = assertServiceType(input.serviceType)
  const imageRole = assertImageRole(input.imageRole)

  const entityId = String(input.entityId ?? '').trim()
  const entityNameKr = String(input.entityNameKr ?? '').trim()
  if (!entityId) throw new Error('entity_id 가 필요합니다.')
  if (!entityNameKr) throw new Error('entity_name_kr 이 필요합니다.')
  if (input.fileBuffer.length > MAX_UPLOAD_BYTES) throw new Error('파일 크기는 30MB 이하여야 합니다.')

  const entityNameEn = input.entityNameEn?.trim() || null
  const supplierName = input.supplierName?.trim() || null

  const { sourceType, sourceName, sourceNote, isGenerated } = resolveImageAssetSource({
    originalFileName: input.originalFileName,
    explicitSourceTypeRaw: input.sourceType,
    explicitSourceNoteRaw: input.sourceNote,
    isManualUpload: true,
    isGeminiAuto: input.isGeminiAuto ?? false,
    isPexelsAuto: input.isPexelsAuto ?? false,
  })

  const webp = await convertToWebp(input.fileBuffer, { maxWidth: 2400, quality: 82 })
  const mimeType = 'image/webp'
  const fileExt = 'webp'

  const projectUrl = getSupabaseProjectPublicUrl()
  const bucket = IMAGE_ASSET_STORAGE_BUCKET

  const prepared = prepareOperationalImageAsset({
    entityType,
    serviceType,
    imageRole,
    supplierName,
    entityNameKr,
    entityNameEn,
    groupKeyInput: input.groupKey,
    sortOrder: input.sortOrder,
    projectUrl,
  })

  const { fileName, storagePath, publicUrl, altKr, altEn } = prepared

  await uploadPublicImage({
    bucket,
    path: storagePath,
    body: webp.buffer,
    contentType: mimeType,
    upsert: false,
  })

  const id = randomUUID()
  const now = new Date().toISOString()

  try {
    if (input.isPrimary) {
      await clearPrimaryForEntity(entityType, entityId)
    }

    const created = await insertImageAssetRow({
      id,
      entity_type: entityType,
      entity_id: entityId,
      entity_name_kr: entityNameKr,
      entity_name_en: entityNameEn,
      supplier_name: supplierName,
      service_type: serviceType,
      image_role: imageRole,
      is_primary: input.isPrimary,
      sort_order: input.sortOrder,
      file_name: fileName,
      file_ext: fileExt,
      mime_type: mimeType,
      storage_bucket: bucket,
      storage_path: storagePath,
      public_url: publicUrl,
      alt_kr: altKr,
      alt_en: altEn,
      title_kr: input.titleKr?.trim() || null,
      title_en: input.titleEn?.trim() || null,
      seo_title_kr: input.seoTitleKr?.trim() || null,
      seo_title_en: input.seoTitleEn?.trim() || null,
      source_type: sourceType,
      source_name: sourceName,
      source_note: sourceNote,
      is_generated: isGenerated,
      upload_status: 'completed',
      uploaded_by: input.uploadedBy?.trim() || null,
      sheet_sync_status: 'skipped',
      sheet_sync_error: null,
      sheet_synced_at: null,
      uploaded_at: now,
      updated_at: now,
    })

    return { ok: true, asset: created }
  } catch (e) {
    console.error('[image-asset] DB(image_assets) 저장 실패 — Storage 롤백:', storagePath, e)
    await removePublicObject(bucket, storagePath)
    throw e
  }
}

export async function retryImageAssetSheetSync(_id: string): Promise<{ ok: false; error: string }> {
  return { ok: false, error: 'Google Sheet 연동이 비활성화되어 있습니다.' }
}

export async function patchImageAsset(
  id: string,
  patch: {
    isPrimary?: boolean
    sortOrder?: number
    altKr?: string | null
    altEn?: string | null
    /** camelCase API — DB source_type */
    sourceType?: string | null
    sourceNote?: string | null
    seoTitleKr?: string | null
    seoTitleEn?: string | null
  }
): Promise<ImageAssetRow> {
  const existing = await findImageAssetById(id)
  if (!existing) {
    throw new Error('이미지 자산을 찾을 수 없습니다.')
  }
  if (patch.isPrimary === true) {
    await clearPrimaryForEntity(existing.entity_type, existing.entity_id)
  }

  const lockedIstock =
    existing.source_type === 'istock' || detectImageSourceTypeFromFilename(existing.file_name) === 'istock'
  let nextSourceType: ImageSourceType = existing.source_type as ImageSourceType
  if (lockedIstock) {
    nextSourceType = 'istock'
  } else if (patch.sourceType !== undefined && patch.sourceType !== null) {
    const raw = String(patch.sourceType).trim()
    if (raw === '') {
      /* keep */
    } else {
      nextSourceType = parseOptionalImageSourceType(raw) ?? nextSourceType
    }
  }

  const nextIsGenerated = isGeneratedImageSourceType(nextSourceType)
  const nextSourceName = sourceTypeToSourceName(nextSourceType)

  let nextSourceNote: string | null | undefined = undefined
  if (patch.sourceNote !== undefined) {
    const t = patch.sourceNote == null ? '' : String(patch.sourceNote).trim()
    nextSourceNote = t === '' ? null : t.slice(0, 2000)
  }

  return updateImageAssetById(id, {
    ...(patch.sortOrder !== undefined ? { sort_order: patch.sortOrder } : {}),
    ...(patch.altKr !== undefined ? { alt_kr: patch.altKr ?? '' } : {}),
    ...(patch.altEn !== undefined ? { alt_en: patch.altEn ?? '' } : {}),
    ...(patch.isPrimary !== undefined ? { is_primary: patch.isPrimary } : {}),
    ...(patch.sourceType !== undefined || patch.sourceNote !== undefined || lockedIstock
      ? {
          source_type: nextSourceType,
          source_name: nextSourceName,
          ...(nextSourceNote !== undefined ? { source_note: nextSourceNote } : {}),
          is_generated: nextIsGenerated,
        }
      : {}),
    ...(patch.seoTitleKr !== undefined ? { seo_title_kr: patch.seoTitleKr ?? null } : {}),
    ...(patch.seoTitleEn !== undefined ? { seo_title_en: patch.seoTitleEn ?? null } : {}),
  })
}
