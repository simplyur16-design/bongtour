import { describe, expect, it } from 'vitest'
import { BONGTOUR_ROUTE_MAP_RAW_META_KEY } from '@/lib/bongtour-route-map-persist-ssot'
import { buildPublicRouteMapView } from '@/lib/bongtour-route-map-public'

describe('buildPublicRouteMapView', () => {
  it('returns null when rawMeta has no route map', () => {
    expect(buildPublicRouteMapView(null)).toBeNull()
    expect(buildPublicRouteMapView('{}')).toBeNull()
  })

  it('exposes ready image and cities caption without storagePath', () => {
    const raw = JSON.stringify({
      [BONGTOUR_ROUTE_MAP_RAW_META_KEY]: {
        version: 'route-map-v1',
        status: 'ready',
        imageUrl: 'https://cdn.example/map.webp',
        storagePath: 'secret/path.webp',
        routeSummary: '부다페스트 → 프라하',
        cities: ['부다페스트', '프라하'],
        edges: [],
        generatedAt: '2026-10-20T00:00:00.000Z',
        source: 'deterministic_svg',
      },
    })
    const view = buildPublicRouteMapView(raw)
    expect(view?.showMap).toBe(true)
    expect(view?.imageUrl).toBe('https://cdn.example/map.webp')
    expect(view?.citiesCaption).toBe('부다페스트 → 프라하')
    expect(JSON.stringify(view)).not.toContain('storagePath')
  })
})
