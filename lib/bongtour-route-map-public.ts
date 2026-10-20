/**
 * 공개 상품 상세용 동선지도 DTO — rawMeta 전체·storagePath 미노출.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: public route map view — manifest
 */

import {
  readBongtourRouteMapPersisted,
  type BongtourRouteMapPersistedV1,
} from '@/lib/bongtour-route-map-persist-ssot'

/** 공개 응답에 실을 최소 필드 */
export type PublicRouteMapView = {
  status: 'ready' | 'failed' | 'generating'
  imageUrl: string | null
  routeSummary: string
  cities: string[]
  citiesCaption: string
  showMap: boolean
}

export function buildPublicRouteMapView(
  rawMeta: string | null | undefined,
): PublicRouteMapView | null {
  const persisted = readBongtourRouteMapPersisted(rawMeta)
  if (!persisted) return null
  return toPublicRouteMapView(persisted)
}

export function toPublicRouteMapView(persisted: BongtourRouteMapPersistedV1): PublicRouteMapView {
  const cities = persisted.cities.filter((c) => c.trim().length > 0)
  const citiesCaption = cities.join(' → ')
  const ready = persisted.status === 'ready' && !!persisted.imageUrl?.trim()
  return {
    status: persisted.status,
    imageUrl: ready ? persisted.imageUrl : null,
    routeSummary: persisted.routeSummary?.trim() || citiesCaption,
    cities,
    citiesCaption,
    showMap: cities.length >= 2 || ready,
  }
}
