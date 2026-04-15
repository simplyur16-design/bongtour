/**
 * 이미지 자산 경로·파일명용 slug (서버 전용).
 */

import { slugify as transliterateSlugify } from 'transliteration'

/** 공개 스토리지 경로·파일명 등 범용 slug (한글 등 → 라틴 하이픈). */
export function toAssetSlug(input: string): string {
  const raw = transliterateSlugify(String(input ?? '').trim(), {
    lowercase: true,
    separator: '-',
    trim: true,
  })
  const collapsed = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return collapsed || 'asset'
}

const SUPPLIER_SLUG_ALIASES: Record<string, string> = {
  모두투어: 'modetour',
  modetour: 'modetour',
  하나투어: 'hanatour',
  hanatour: 'hanatour',
  참좋은여행: 'verygoodtour',
  참좋은여행사: 'verygoodtour',
  verygoodtour: 'verygoodtour',
  노랑풍선: 'ybtour',
  ybtour: 'ybtour',
  yellowballoon: 'ybtour',
}

export function supplierNameToSlug(supplierName: string): string {
  const t = String(supplierName ?? '').trim()
  if (!t) return 'supplier'
  const key = t.toLowerCase()
  if (SUPPLIER_SLUG_ALIASES[t]) return SUPPLIER_SLUG_ALIASES[t]
  if (SUPPLIER_SLUG_ALIASES[key]) return SUPPLIER_SLUG_ALIASES[key]
  return toAssetSlug(t)
}

const SUPPLIER_DISPLAY_EN: Record<string, string> = {
  모두투어: 'Modetour',
  modetour: 'Modetour',
  하나투어: 'Hanatour',
  hanatour: 'Hanatour',
  참좋은여행: 'Verygoodtour',
  참좋은여행사: 'Verygoodtour',
  verygoodtour: 'Verygoodtour',
  노랑풍선: 'YB Tour',
  ybtour: 'YB Tour',
  yellowballoon: 'YB Tour',
}

export function supplierDisplayEn(supplierName: string | null | undefined): string {
  const t = String(supplierName ?? '').trim()
  if (!t) return ''
  const key = t.toLowerCase()
  if (SUPPLIER_DISPLAY_EN[t]) return SUPPLIER_DISPLAY_EN[t]
  if (SUPPLIER_DISPLAY_EN[key]) return SUPPLIER_DISPLAY_EN[key]
  if (/^[a-zA-Z]/.test(t)) return t
  return toAssetSlug(t)
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function entityLabelToSlug(entityNameKr: string, entityNameEn?: string | null): string {
  const primary = (entityNameEn ?? '').trim() || (entityNameKr ?? '').trim()
  return toAssetSlug(primary)
}
