/**
 * Supabase Postgres public.image_assets — 메타데이터 SSOT (서버에서만 service role 사용).
 * file_name / storage_path / public_url / alt_* 생성은 lib/image-asset-naming.ts 와 일치시킨다.
 * source_type / source_note: lib/image-asset-source.ts
 */

import { getSupabaseAdmin } from '@/lib/supabase-image-storage'

export const IMAGE_ASSETS_TABLE = 'image_assets' as const

/** DB snake_case ↔ 앱에서 사용하는 행 타입 */
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

export async function countImageAssetsByEntityRole(
  entityType: string,
  entityId: string,
  imageRole: string
): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from(IMAGE_ASSETS_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('image_role', imageRole)
  if (error) throw new Error(`image_assets count 실패: ${error.message}`)
  return count ?? 0
}

export async function clearPrimaryForEntity(entityType: string, entityId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from(IMAGE_ASSETS_TABLE)
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('is_primary', true)
  if (error) throw new Error(`image_assets primary 해제 실패: ${error.message}`)
}

export type InsertImageAssetPayload = Omit<ImageAssetRow, 'uploaded_at' | 'updated_at'> & {
  uploaded_at?: string
  updated_at?: string
}

export async function insertImageAssetRow(row: InsertImageAssetPayload): Promise<ImageAssetRow> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const payload = {
    ...row,
    uploaded_at: row.uploaded_at ?? now,
    updated_at: row.updated_at ?? now,
  }
  const { data, error } = await supabase.from(IMAGE_ASSETS_TABLE).insert(payload).select().single()
  if (error) throw new Error(`image_assets insert 실패: ${error.message}`)
  return data as ImageAssetRow
}

export async function findImageAssetById(id: string): Promise<ImageAssetRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from(IMAGE_ASSETS_TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`image_assets 조회 실패: ${error.message}`)
  return data as ImageAssetRow | null
}

/** 일정 이미지 URL이 image_assets public_url 과 같을 때 SEO·표시명 보강용 */
export async function findImageAssetByPublicUrl(urlInput: string | null | undefined): Promise<ImageAssetRow | null> {
  const raw = String(urlInput ?? '').trim().split('?')[0]
  if (!raw.startsWith('http')) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from(IMAGE_ASSETS_TABLE).select('*').eq('public_url', raw).maybeSingle()
  if (error) throw new Error(`image_assets URL 조회 실패: ${error.message}`)
  if (data) return data as ImageAssetRow
  const alt = raw.endsWith('/') ? raw.slice(0, -1) : `${raw}/`
  const { data: data2 } = await supabase.from(IMAGE_ASSETS_TABLE).select('*').eq('public_url', alt).maybeSingle()
  return (data2 as ImageAssetRow | null) ?? null
}

/**
 * 목록 등 배치: `public_url` 이 정확히 일치하는 행만 반환.
 * 호출부에서 쿼리·슬래시 변형을 넣어 매칭률을 올린다.
 */
export async function findImageAssetsByPublicUrls(urls: string[]): Promise<ImageAssetRow[]> {
  const uniq = [...new Set(urls.map((u) => String(u).trim()).filter(Boolean))]
  if (uniq.length === 0) return []
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from(IMAGE_ASSETS_TABLE).select('*').in('public_url', uniq)
    if (error) throw new Error(error.message)
    return (data ?? []) as ImageAssetRow[]
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
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from(IMAGE_ASSETS_TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(`image_assets 시트 상태 갱신 실패: ${error.message}`)
}

export async function listRecentImageAssets(take: number): Promise<ImageAssetRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(IMAGE_ASSETS_TABLE)
    .select('*')
    .order('uploaded_at', { ascending: false })
    .limit(take)
  if (error) throw new Error(`image_assets 목록 실패: ${error.message}`)
  return (data ?? []) as ImageAssetRow[]
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
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(IMAGE_ASSETS_TABLE)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`image_assets 수정 실패: ${error.message}`)
  return data as ImageAssetRow
}
