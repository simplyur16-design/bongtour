/**
 * 운영형 file_name / storage_path / public_url / seq / alt (SEO·OG·구조화데이터 재사용).
 * source_type / source_note: lib/image-asset-source.ts
 */

import {
  buildStoragePath,
  IMAGE_ASSET_STORAGE_BUCKET,
  type ImageAssetEntityType,
  type ImageAssetRole,
  type ImageAssetServiceType,
} from '@/lib/image-asset-ssot'
import { buildNcloudPublicUrl } from '@/lib/ncloud-object-storage'
import {
  entityLabelToSlug,
  supplierDisplayEn,
  supplierNameToSlug,
  toAssetSlug,
} from '@/lib/image-asset-slug'

export { IMAGE_ASSET_STORAGE_BUCKET }

/** sort_order 정수 → seq (01–99), 규칙: seq = sort_order + 1 */
export function seqFromSortOrder(sortOrder: number): number {
  const n = Number.isFinite(sortOrder) ? Math.floor(Number(sortOrder)) : 0
  return Math.min(99, Math.max(1, n + 1))
}

export type OperationalPathInput = {
  entityType: ImageAssetEntityType
  serviceType: ImageAssetServiceType
  imageRole: ImageAssetRole
  supplierName?: string | null
  entityNameKr: string
  entityNameEn?: string | null
  /** city/country/study/bus: 국가·지역 slug (city는 국가, country는 국가=entity와 동일 시 생략 파일명 규칙) */
  groupKeyInput?: string | null
  sortOrder: number
}

export function resolveOperationalGroupKey(p: OperationalPathInput): string {
  switch (p.entityType) {
    case 'product':
      return supplierNameToSlug(p.supplierName ?? 'supplier')
    case 'page':
      return 'common'
    case 'city':
    case 'country':
    case 'study':
    case 'bus': {
      const raw = (p.groupKeyInput ?? '').trim()
      if (raw) return toAssetSlug(raw)
      return entityLabelToSlug(p.entityNameKr, p.entityNameEn)
    }
    default:
      return 'asset'
  }
}

export function resolveOperationalEntitySlug(p: OperationalPathInput): string {
  return entityLabelToSlug(p.entityNameKr, p.entityNameEn)
}

/**
 * country 이고 group_key === entity_slug 일 때 파일명 단축: country-japan-hero-01.webp
 * 그 외: {entity}-{group}-{slug}-{role}-{seq}.webp
 */
export function buildOperationalFileName(params: {
  entityType: ImageAssetEntityType
  groupKey: string
  entitySlug: string
  imageRole: ImageAssetRole
  seq: number
  ext: string
}): string {
  if (params.seq < 1 || params.seq > 99) throw new Error('seq 는 1–99 범위여야 합니다.')
  const seqStr = String(params.seq).padStart(2, '0')
  const ext = String(params.ext).replace(/^\./, '').toLowerCase()
  if (params.entityType === 'country' && params.groupKey === params.entitySlug) {
    return `${params.entityType}-${params.groupKey}-${params.imageRole}-${seqStr}.${ext}`
  }
  return `${params.entityType}-${params.groupKey}-${params.entitySlug}-${params.imageRole}-${seqStr}.${ext}`
}

export function buildOperationalStoragePath(params: {
  entityType: ImageAssetEntityType
  serviceType: ImageAssetServiceType
  groupKey: string
  entitySlug: string
  imageRole: ImageAssetRole
  fileName: string
}): string {
  return buildStoragePath({
    entityType: params.entityType,
    serviceType: params.serviceType,
    groupKey: params.groupKey,
    entitySlug: params.entitySlug,
    imageRole: params.imageRole,
    fileName: params.fileName,
  })
}

/** `NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL` + object key (버킷 prefix는 base URL에 포함) */
export function buildOperationalPublicUrl(publicBaseUrl: string, storagePath: string): string {
  return buildNcloudPublicUrl(publicBaseUrl, storagePath)
}

export function buildAltKrOperational(p: {
  entityType: ImageAssetEntityType
  imageRole: ImageAssetRole
  supplierName?: string | null
  entityNameKr: string
  entityNameEn?: string | null
  seq: number
}): string {
  const supplier = (p.supplierName ?? '').trim()
  const nameKr = (p.entityNameKr ?? '').trim()
  const idx = p.seq

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
      const region = nameKr
      return `${region} 국외연수 안내 대표 이미지`
    }
    case 'bus': {
      const region = nameKr
      return `${region} 전세버스 서비스 대표 이미지`
    }
    case 'page':
      return `${nameKr} 안내 대표 이미지`
    default:
      return `${nameKr} 대표 이미지`
  }
}

export function buildAltEnOperational(p: {
  entityType: ImageAssetEntityType
  imageRole: ImageAssetRole
  supplierName?: string | null
  entityNameKr: string
  entityNameEn?: string | null
  seq: number
}): string | null {
  const nameEn = (p.entityNameEn ?? '').trim()
  const nameKr = (p.entityNameKr ?? '').trim()
  const productTitle = nameEn || nameKr
  const idx = p.seq

  switch (p.entityType) {
    case 'product': {
      const s = supplierDisplayEn(p.supplierName)
      const head = [s, productTitle].filter(Boolean).join(' ')
      if (!head) return null
      if (p.imageRole === 'gallery') {
        return `${head} related image ${idx}`.trim()
      }
      return `${head} main image`.trim()
    }
    case 'city':
      return productTitle ? `${productTitle} travel main image` : null
    case 'country':
      return productTitle ? `${productTitle} travel introduction image` : null
    case 'study':
      return productTitle ? `${productTitle} study tour main image` : null
    case 'bus':
      return productTitle ? `${productTitle} charter bus service image` : null
    case 'page':
      return productTitle ? `${productTitle} page main image` : null
    default:
      return productTitle ? `${productTitle} image` : null
  }
}

export function prepareOperationalImageAsset(
  p: OperationalPathInput & { publicBaseUrl: string }
): {
  groupKey: string
  entitySlug: string
  seq: number
  fileName: string
  storagePath: string
  publicUrl: string
  altKr: string
  altEn: string
} {
  const groupKey = resolveOperationalGroupKey(p)
  const entitySlug = resolveOperationalEntitySlug(p)
  const seq = seqFromSortOrder(p.sortOrder)
  const fileName = buildOperationalFileName({
    entityType: p.entityType,
    groupKey,
    entitySlug,
    imageRole: p.imageRole,
    seq,
    ext: 'webp',
  })
  const storagePath = buildOperationalStoragePath({
    entityType: p.entityType,
    serviceType: p.serviceType,
    groupKey,
    entitySlug,
    imageRole: p.imageRole,
    fileName,
  })
  const publicUrl = buildOperationalPublicUrl(p.publicBaseUrl, storagePath)
  const altKr = buildAltKrOperational({
    entityType: p.entityType,
    imageRole: p.imageRole,
    supplierName: p.supplierName,
    entityNameKr: p.entityNameKr,
    entityNameEn: p.entityNameEn,
    seq,
  })
  const altEnRaw = buildAltEnOperational({
    entityType: p.entityType,
    imageRole: p.imageRole,
    supplierName: p.supplierName,
    entityNameKr: p.entityNameKr,
    entityNameEn: p.entityNameEn,
    seq,
  })
  return {
    groupKey,
    entitySlug,
    seq,
    fileName,
    storagePath,
    publicUrl,
    altKr,
    altEn: altEnRaw ?? '',
  }
}
