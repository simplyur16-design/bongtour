/**
 * 관리자 이미지 업로드 SSOT: slug / 파일명 / alt / storage path / public URL 생성.
 * 프론트는 규칙을 복제하지 않고 서버만 사용한다.
 */

import { entityLabelToSlug, supplierDisplayEn, supplierNameToSlug, toAssetSlug } from '@/lib/image-asset-slug'

export { toAssetSlug } from '@/lib/image-asset-slug'

/** Ncloud Object Storage 버킷 기본값 (환경변수와 동기: NCLOUD_OBJECT_STORAGE_BUCKET) */
export const IMAGE_ASSET_STORAGE_BUCKET = 'bongtour' as const

export type ImageAssetEntityType = 'product' | 'city' | 'country' | 'study' | 'bus' | 'page'

export type ImageAssetServiceType = 'overseas' | 'domestic' | 'study' | 'bus' | 'support'

export type ImageAssetRole = 'hero' | 'thumb' | 'gallery' | 'og'

const ENTITY_TYPES = new Set<ImageAssetEntityType>(['product', 'city', 'country', 'study', 'bus', 'page'])
const SERVICE_TYPES = new Set<ImageAssetServiceType>(['overseas', 'domestic', 'study', 'bus', 'support'])
const IMAGE_ROLES = new Set<ImageAssetRole>(['hero', 'thumb', 'gallery', 'og'])

export function assertEntityType(v: string): ImageAssetEntityType {
  const x = v as ImageAssetEntityType
  if (!ENTITY_TYPES.has(x)) throw new Error(`entity_type 허용값이 아닙니다: ${v}`)
  return x
}

export function assertServiceType(v: string): ImageAssetServiceType {
  const x = v as ImageAssetServiceType
  if (!SERVICE_TYPES.has(x)) throw new Error(`service_type 허용값이 아닙니다: ${v}`)
  return x
}

export function assertImageRole(v: string): ImageAssetRole {
  const x = v as ImageAssetRole
  if (!IMAGE_ROLES.has(x)) throw new Error(`image_role 허용값이 아닙니다: ${v}`)
  return x
}

export type GroupKeyContext = {
  entityType: ImageAssetEntityType
  serviceType: ImageAssetServiceType
  supplierName?: string | null
  /** city/country/study/bus/page 용 지역·국가 등 그룹 slug (미입력 시 서버 추론) */
  groupKeyInput?: string | null
  entityNameEn?: string | null
}

/**
 * path 규칙의 group_key SSOT.
 * - product: 공급사 slug
 * - page: common
 * - 그 외: 입력 groupKeyInput 또는 entity_name_en 기반
 */
export function resolveGroupKey(ctx: GroupKeyContext): string {
  if (ctx.entityType === 'product') {
    return supplierNameToSlug(ctx.supplierName ?? 'supplier')
  }
  if (ctx.entityType === 'page') {
    return 'common'
  }
  const g = (ctx.groupKeyInput ?? '').trim()
  if (g) return toAssetSlug(g)
  return toAssetSlug(ctx.entityNameEn ?? 'region')
}

export function resolveEntitySlug(_entityType: ImageAssetEntityType, entityNameKr: string, entityNameEn?: string | null): string {
  return entityLabelToSlug(entityNameKr, entityNameEn)
}

export type StandardFileNameParams = {
  entityType: ImageAssetEntityType
  groupKey: string
  entitySlug: string
  imageRole: ImageAssetRole
  seq: number
  ext: string
}

/**
 * {entity_type}-{group_key}-{entity_slug}-{image_role}-{seq}.{ext} — seq 는 두 자리 01..
 */
export function buildStandardFileName(p: StandardFileNameParams): string {
  if (p.seq < 1 || p.seq > 99) throw new Error('seq 는 1–99 범위여야 합니다.')
  const seqStr = String(p.seq).padStart(2, '0')
  const ext = String(p.ext).replace(/^\./, '').toLowerCase()
  return `${p.entityType}-${p.groupKey}-${p.entitySlug}-${p.imageRole}-${seqStr}.${ext}`
}

export type StoragePathParams = {
  entityType: ImageAssetEntityType
  serviceType: ImageAssetServiceType
  groupKey: string
  entitySlug: string
  imageRole: ImageAssetRole
  fileName: string
}

/**
 * {entity_type}/{service_type}/{group_key}/{entity_slug}/{image_role}/{file_name}
 */
export function buildStoragePath(p: StoragePathParams): string {
  const parts = [p.entityType, p.serviceType, p.groupKey, p.entitySlug, p.imageRole, p.fileName]
  for (const part of parts) {
    if (!part || part.includes('..') || part.includes('/') || part.includes('\\')) {
      throw new Error('storage path 구성 요소가 유효하지 않습니다.')
    }
  }
  return parts.join('/')
}

export type AltParams = {
  entityType: ImageAssetEntityType
  imageRole: ImageAssetRole
  supplierName?: string | null
  entityNameKr: string
  entityNameEn?: string | null
  /** gallery 일 때 1-based 이미지 번호 */
  galleryIndex?: number
  /** study/bus/page 지역 표기 */
  regionLabelKr?: string
  regionLabelEn?: string
}

function galleryIndexLabel(role: ImageAssetRole, seq: number): number {
  if (role === 'gallery') return seq
  return 1
}

export function buildAltKr(p: AltParams): string {
  const supplier = (p.supplierName ?? '').trim()
  const nameKr = (p.entityNameKr ?? '').trim()
  const idx = galleryIndexLabel(p.imageRole, p.galleryIndex ?? 1)

  switch (p.entityType) {
    case 'product': {
      const head = [supplier, nameKr].filter(Boolean).join(' ')
      if (p.imageRole === 'gallery') {
        return `${head} 관련 이미지 ${idx}`.trim()
      }
      return `${head} 대표 이미지`.trim()
    }
    case 'city':
      return `${nameKr} 여행 대표 이미지`
    case 'country':
      return `${nameKr} 여행 소개 대표 이미지`
    case 'study': {
      const region = (p.regionLabelKr ?? nameKr).trim()
      return `${region} 국외연수 안내 대표 이미지`
    }
    case 'bus': {
      const region = (p.regionLabelKr ?? nameKr).trim()
      return `${region} 전세버스 서비스 대표 이미지`
    }
    case 'page': {
      const region = (p.regionLabelKr ?? nameKr).trim()
      return `${region} 안내 대표 이미지`
    }
    default:
      return `${nameKr} 대표 이미지`
  }
}

export function buildAltEn(p: AltParams): string {
  const nameEn = (p.entityNameEn ?? '').trim()
  const nameKr = (p.entityNameKr ?? '').trim()
  const productTitle = nameEn || nameKr
  const idx = galleryIndexLabel(p.imageRole, p.galleryIndex ?? 1)

  switch (p.entityType) {
    case 'product': {
      const s = supplierDisplayEn(p.supplierName)
      const head = [s, productTitle].filter(Boolean).join(' ')
      if (p.imageRole === 'gallery') {
        return `${head} related image ${idx}`.trim()
      }
      return `${head} main image`.trim()
    }
    case 'city':
      return `${productTitle} travel main image`
    case 'country':
      return `${productTitle} travel introduction image`
    case 'study': {
      const region = (p.regionLabelEn ?? productTitle).trim()
      return `${region} study tour main image`
    }
    case 'bus': {
      const region = (p.regionLabelEn ?? productTitle).trim()
      return `${region} charter bus service image`
    }
    case 'page':
      return `${productTitle} page main image`
    default:
      return `${productTitle} image`
  }
}
