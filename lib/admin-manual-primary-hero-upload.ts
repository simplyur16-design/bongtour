/**
 * 관리자 대표 이미지 수동 업로드 SSOT: photo-pool 업로드 후 PATCH로 product.bgImage* 반영.
 * 상품 상세(/admin/products/[id])·pending 패널 등 동일 흐름에서 사용한다.
 *
 * 출처 preset 라벨·매핑은 상품 이미지(image_assets) 수동 업로드와 동일 체계를 쓴다.
 */
import { resizeImageFileForUpload } from '@/lib/browser-resize-image-for-upload'
import { isAllowedImageSourceType, type ImageSourceType } from '@/lib/image-asset-source'

export type AdminManualPrimaryHeroUploadPreset =
  | 'photo_owned'
  | 'istock'
  | 'gemini_manual'
  | 'pexels'
  | 'other'

export const ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS: {
  value: AdminManualPrimaryHeroUploadPreset
  label: string
}[] = [
  { value: 'photo_owned', label: '직접 업로드' },
  { value: 'istock', label: 'iStock' },
  { value: 'gemini_manual', label: 'AI 생성' },
  { value: 'pexels', label: 'Pexels' },
  { value: 'other', label: '기타' },
]

export function mapAdminManualPrimaryHeroUploadPresetToPatch(
  preset: AdminManualPrimaryHeroUploadPreset,
  otherNote: string
): {
  primaryImageSource: string
  primaryImagePhotographer: string | null
  primaryImageIsGenerated: boolean
} {
  switch (preset) {
    case 'photo_owned':
      return { primaryImageSource: 'photo_owned', primaryImagePhotographer: null, primaryImageIsGenerated: false }
    case 'istock':
      return { primaryImageSource: 'istock', primaryImagePhotographer: 'iStock', primaryImageIsGenerated: false }
    case 'gemini_manual':
      return { primaryImageSource: 'gemini_manual', primaryImagePhotographer: null, primaryImageIsGenerated: true }
    case 'pexels':
      return { primaryImageSource: 'pexels', primaryImagePhotographer: null, primaryImageIsGenerated: false }
    case 'other':
      return {
        primaryImageSource: 'other',
        primaryImagePhotographer: otherNote.trim() || null,
        primaryImageIsGenerated: false,
      }
    default:
      return { primaryImageSource: 'photo_owned', primaryImagePhotographer: null, primaryImageIsGenerated: false }
  }
}

/**
 * image_assets POST용: UI preset → 허용 source_type + 선택 source_note.
 * `other` 는 DB에 `other` 타입이 없으므로 `photo_owned` + 메모로 저장한다.
 */
export function mapAdminManualImageSourcePresetToImageAssetUpload(
  preset: AdminManualPrimaryHeroUploadPreset,
  otherNote: string
): { sourceType: ImageSourceType; sourceNote: string | null } {
  if (preset === 'other') {
    const n = otherNote.trim()
    return { sourceType: 'photo_owned', sourceNote: n ? n : null }
  }
  const m = mapAdminManualPrimaryHeroUploadPresetToPatch(preset, '')
  const raw = m.primaryImageSource
  if (isAllowedImageSourceType(raw)) {
    return { sourceType: raw, sourceNote: null }
  }
  return { sourceType: 'photo_owned', sourceNote: null }
}

export type AdminManualPrimaryHeroUploadResult =
  | { ok: true; product: Record<string, unknown> }
  | { ok: false; stage: 'upload' | 'patch'; message: string }

export async function adminManualPrimaryHeroUploadAndPatch(
  productId: string,
  file: File,
  opts: {
    preset: AdminManualPrimaryHeroUploadPreset
    otherNote: string
    cityName: string
  }
): Promise<AdminManualPrimaryHeroUploadResult> {
  const heroMeta = mapAdminManualPrimaryHeroUploadPresetToPatch(opts.preset, opts.otherNote)
  const toSend = await resizeImageFileForUpload(file)
  const form = new FormData()
  form.append('file', toSend)
  form.append('cityName', opts.cityName)
  form.append('attractionName', 'primary_hero')
  form.append('source', 'manual-upload')

  let uploadRes: Response
  try {
    uploadRes = await fetch('/api/admin/photo-pool/upload', { method: 'POST', body: form })
  } catch (e) {
    return {
      ok: false,
      stage: 'upload',
      message: e instanceof Error ? e.message : '네트워크 오류',
    }
  }

  const upload = (await uploadRes.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    message?: string
    items?: { filePath: string; id: string }[]
  }
  if (!uploadRes.ok || !upload.ok || !Array.isArray(upload.items) || upload.items.length === 0) {
    return {
      ok: false,
      stage: 'upload',
      message: upload.message ?? upload.error ?? `HTTP ${uploadRes.status}`,
    }
  }

  const item = upload.items[0]
  let patchRes: Response
  let text: string
  try {
    patchRes = await fetch(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryImageUrl: item.filePath,
        primaryImageSource: heroMeta.primaryImageSource,
        primaryImagePhotographer: heroMeta.primaryImagePhotographer,
        primaryImageSourceUrl: null,
        primaryImageExternalId: item.id,
        primaryImageIsGenerated: heroMeta.primaryImageIsGenerated,
      }),
    })
    text = await patchRes.text()
  } catch (e) {
    return {
      ok: false,
      stage: 'patch',
      message: e instanceof Error ? e.message : '네트워크 오류',
    }
  }

  let updated: Record<string, unknown> | null = null
  try {
    updated = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    updated = null
  }
  if (patchRes.ok && updated && typeof updated.id === 'string') {
    return { ok: true, product: updated }
  }

  let errMsg = patchRes.ok ? '상품 응답 형식 오류' : '상품 저장 실패'
  try {
    const err = text ? (JSON.parse(text) as { error?: string }) : null
    if (err?.error) errMsg = err.error
  } catch {
    // ignore
  }
  return { ok: false, stage: 'patch', message: errMsg }
}
