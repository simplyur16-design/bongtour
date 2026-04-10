/**
 * 이미지 메타데이터 — Prisma SQLite `image_assets` (서버 전용).
 * 파일 바이너리는 Supabase Storage.
 */

import { prisma } from '@/lib/prisma'
import type { ImageAsset as ImageAssetModel } from '../prisma-gen-runtime'

export const IMAGE_ASSETS_TABLE = 'image_assets' as const

/** DB snake_case ↔ 앱에서 사용하는 행 타입 (기존 API 호환) */
export type ImageAssetRow = {
  id: string
  entity_type: string
  entity_id: string
  entity_name_kr: string
  entity_name_en: string | null
  supplier_name: string | null
  service_type: string
  image_role: string
  is_primary: boolean
  sort_order: number
  file_name: string
  file_ext: string
  mime_type: string
  storage_bucket: string
  storage_path: string
  public_url: string
  alt_kr: string
  alt_en: string
  title_kr: string | null
  title_en: string | null
  source_type: string
  source_name: string | null
  source_note: string | null
  is_generated: boolean | null
  seo_title_kr: string | null
  seo_title_en: string | null
  upload_status: string
  uploaded_by: string | null
  uploaded_at: string
  updated_at: string
  sheet_sync_status: string | null
  sheet_sync_error: string | null
  sheet_synced_at: string | null
}

function toRow(m: ImageAssetModel): ImageAssetRow {
  return {
    id: m.id,
    entity_type: m.entityType,
    entity_id: m.entityId,
    entity_name_kr: m.entityNameKr,
    entity_name_en: m.entityNameEn,
    supplier_name: m.supplierName,
    service_type: m.serviceType,
    image_role: m.imageRole,
    is_primary: m.isPrimary,
    sort_order: m.sortOrder,
    file_name: m.fileName,
    file_ext: m.fileExt,
    mime_type: m.mimeType,
    storage_bucket: m.storageBucket,
    storage_path: m.storagePath,
    public_url: m.publicUrl,
    alt_kr: m.altKr,
    alt_en: m.altEn,
    title_kr: m.titleKr,
    title_en: m.titleEn,
    source_type: m.sourceType,
    source_name: m.sourceName,
    source_note: m.sourceNote,
    is_generated: m.isGenerated,
    seo_title_kr: m.seoTitleKr,
    seo_title_en: m.seoTitleEn,
    upload_status: m.uploadStatus,
    uploaded_by: m.uploadedBy,
    uploaded_at: m.uploadedAt.toISOString(),
    updated_at: m.updatedAt.toISOString(),
    sheet_sync_status: m.sheetSyncStatus,
    sheet_sync_error: m.sheetSyncError,
    sheet_synced_at: m.sheetSyncedAt?.toISOString() ?? null,
  }
}

export async function countImageAssetsByEntityRole(
  entityType: string,
  entityId: string,
  imageRole: string
): Promise<number> {
  return prisma.imageAsset.count({
    where: { entityType, entityId, imageRole },
  })
}

export async function clearPrimaryForEntity(entityType: string, entityId: string): Promise<void> {
  await prisma.imageAsset.updateMany({
    where: { entityType, entityId, isPrimary: true },
    data: { isPrimary: false, updatedAt: new Date() },
  })
}

export type InsertImageAssetPayload = Omit<ImageAssetRow, 'uploaded_at' | 'updated_at'> & {
  uploaded_at?: string
  updated_at?: string
}

export async function insertImageAssetRow(row: InsertImageAssetPayload): Promise<ImageAssetRow> {
  const now = new Date()
  const uploadedAt = row.uploaded_at ? new Date(row.uploaded_at) : now
  const updatedAt = row.updated_at ? new Date(row.updated_at) : now
  const created = await prisma.imageAsset.create({
    data: {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityNameKr: row.entity_name_kr,
      entityNameEn: row.entity_name_en,
      supplierName: row.supplier_name,
      serviceType: row.service_type,
      imageRole: row.image_role,
      isPrimary: row.is_primary,
      sortOrder: row.sort_order,
      fileName: row.file_name,
      fileExt: row.file_ext,
      mimeType: row.mime_type,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      altKr: row.alt_kr,
      altEn: row.alt_en,
      titleKr: row.title_kr,
      titleEn: row.title_en,
      sourceType: row.source_type,
      sourceName: row.source_name,
      sourceNote: row.source_note,
      isGenerated: row.is_generated,
      seoTitleKr: row.seo_title_kr,
      seoTitleEn: row.seo_title_en,
      uploadStatus: row.upload_status,
      uploadedBy: row.uploaded_by,
      uploadedAt,
      updatedAt,
      sheetSyncStatus: row.sheet_sync_status,
      sheetSyncError: row.sheet_sync_error,
      sheetSyncedAt: row.sheet_synced_at ? new Date(row.sheet_synced_at) : null,
    },
  })
  return toRow(created)
}

export async function findImageAssetById(id: string): Promise<ImageAssetRow | null> {
  const m = await prisma.imageAsset.findUnique({ where: { id } })
  return m ? toRow(m) : null
}

export async function findImageAssetByPublicUrl(urlInput: string | null | undefined): Promise<ImageAssetRow | null> {
  const raw = String(urlInput ?? '').trim().split('?')[0]
  if (!raw.startsWith('http')) return null
  const m = await prisma.imageAsset.findFirst({ where: { publicUrl: raw } })
  if (m) return toRow(m)
  const alt = raw.endsWith('/') ? raw.slice(0, -1) : `${raw}/`
  const m2 = await prisma.imageAsset.findFirst({ where: { publicUrl: alt } })
  return m2 ? toRow(m2) : null
}

export async function findImageAssetsByPublicUrls(urls: string[]): Promise<ImageAssetRow[]> {
  const uniq = [...new Set(urls.map((u) => String(u).trim()).filter(Boolean))]
  if (uniq.length === 0) return []
  try {
    const rows = await prisma.imageAsset.findMany({
      where: { publicUrl: { in: uniq } },
    })
    return rows.map(toRow)
  } catch {
    return []
  }
}

export async function updateImageAssetSheetSync(
  id: string,
  patch: {
    sheet_sync_status: string
    sheet_sync_error?: string | null
    sheet_synced_at?: string | null
  }
): Promise<void> {
  await prisma.imageAsset.update({
    where: { id },
    data: {
      sheetSyncStatus: patch.sheet_sync_status,
      sheetSyncError: patch.sheet_sync_error ?? null,
      sheetSyncedAt: patch.sheet_synced_at ? new Date(patch.sheet_synced_at) : null,
      updatedAt: new Date(),
    },
  })
}

export async function listRecentImageAssets(take: number): Promise<ImageAssetRow[]> {
  const rows = await prisma.imageAsset.findMany({
    orderBy: { uploadedAt: 'desc' },
    take,
  })
  return rows.map(toRow)
}

export async function updateImageAssetById(
  id: string,
  patch: Partial<{
    is_primary: boolean
    sort_order: number
    alt_kr: string
    alt_en: string
    source_type: string
    source_name: string | null
    source_note: string | null
    is_generated: boolean | null
    seo_title_kr: string | null
    seo_title_en: string | null
  }>
): Promise<ImageAssetRow> {
  const updated = await prisma.imageAsset.update({
    where: { id },
    data: {
      ...(patch.is_primary !== undefined ? { isPrimary: patch.is_primary } : {}),
      ...(patch.sort_order !== undefined ? { sortOrder: patch.sort_order } : {}),
      ...(patch.alt_kr !== undefined ? { altKr: patch.alt_kr } : {}),
      ...(patch.alt_en !== undefined ? { altEn: patch.alt_en } : {}),
      ...(patch.source_type !== undefined ? { sourceType: patch.source_type } : {}),
      ...(patch.source_name !== undefined ? { sourceName: patch.source_name } : {}),
      ...(patch.source_note !== undefined ? { sourceNote: patch.source_note } : {}),
      ...(patch.is_generated !== undefined ? { isGenerated: patch.is_generated } : {}),
      ...(patch.seo_title_kr !== undefined ? { seoTitleKr: patch.seo_title_kr } : {}),
      ...(patch.seo_title_en !== undefined ? { seoTitleEn: patch.seo_title_en } : {}),
      updatedAt: new Date(),
    },
  })
  return toRow(updated)
}
