import type { ImageAssetRow } from '@/lib/supabase-image-assets-db'

/** 관리자 API JSON 응답용 (camelCase). 프론트는 파일명·URL 규칙을 갖지 않음. */
export function imageAssetRowToApi(row: ImageAssetRow) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityNameKr: row.entity_name_kr,
    entityNameEn: row.entity_name_en,
    imageRole: row.image_role,
    fileName: row.file_name,
    fileExt: row.file_ext,
    mimeType: row.mime_type,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    altKr: row.alt_kr,
    altEn: row.alt_en,
    sourceType: row.source_type,
    sourceName: row.source_name,
    sourceNote: row.source_note,
    isGenerated: row.is_generated,
    seoTitleKr: row.seo_title_kr,
    seoTitleEn: row.seo_title_en,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    sheetSyncStatus: row.sheet_sync_status,
    sheetSyncError: row.sheet_sync_error,
    sheetSyncedAt: row.sheet_synced_at,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
  }
}
