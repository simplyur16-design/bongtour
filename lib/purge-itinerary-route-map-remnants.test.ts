import { describe, expect, it } from 'vitest'
import {
  assertItineraryRouteMapObjectKey,
  stripItineraryRouteMapFromRawMeta,
} from '../scripts/purge-itinerary-route-map-remnants'

describe('purge itinerary route map remnants', () => {
  it('rawMeta에서 itineraryRouteMap 키만 빼고 다른 키는 남긴다', () => {
    const raw = JSON.stringify({
      structuredSignals: { airlineName: '대한항공' },
      itineraryRouteMap: { url: 'https://example.invalid/itinerary-route-maps/a.webp' },
      photo: 'products/cover.webp',
    })
    const out = stripItineraryRouteMapFromRawMeta(raw)
    const next = JSON.parse(out.next ?? '{}') as Record<string, unknown>
    expect(next.itineraryRouteMap).toBeUndefined()
    expect(next.photo).toBe('products/cover.webp')
    expect((next.structuredSignals as { airlineName: string }).airlineName).toBe('대한항공')
    expect(out.removed).toMatchObject({ url: 'https://example.invalid/itinerary-route-maps/a.webp' })
  })

  it('지도 필드가 없으면 rawMeta를 바꾸지 않는다', () => {
    const raw = JSON.stringify({ photo: 'products/cover.webp' })
    expect(stripItineraryRouteMapFromRawMeta(raw).next).toBe(raw)
    expect(stripItineraryRouteMapFromRawMeta('not-json').next).toBe('not-json')
  })

  it('itinerary-route-maps/ 접두어가 아닌 객체 키는 거부한다', () => {
    expect(assertItineraryRouteMapObjectKey('itinerary-route-maps/2026/11/a.webp')).toBe(
      'itinerary-route-maps/2026/11/a.webp',
    )
    expect(() => assertItineraryRouteMapObjectKey('products/cover.webp')).toThrow(/refusing/)
    expect(() => assertItineraryRouteMapObjectKey('itinerary-route-maps/../products/a.webp')).toThrow(/refusing/)
  })
})
