import { describe, expect, it } from 'vitest'
import {
  buildAirHotelHubBrowseQueryKey,
  buildHomeAirHotelPreviewBrowseQueryKey,
  buildOverseasHubBrowseQueryKey,
  buildOverseasHubCatalogFetchQueryKey,
  HOME_AIR_HOTEL_PREVIEW_LIMIT,
  isOverseasHubFullCatalogQueryKey,
  normalizeAirHotelHubUrlSearchParams,
  overseasHubUrlNeedsServerGeoFetch,
} from '@/lib/products-browse-hub-query'

describe('buildHomeAirHotelPreviewBrowseQueryKey', () => {
  it('canonical home preview key — not hub full catalog', () => {
    const key = buildHomeAirHotelPreviewBrowseQueryKey()
    expect(key).toBe(`limit=${HOME_AIR_HOTEL_PREVIEW_LIMIT}&page=1&scope=overseas&type=air-hotel`)
    expect(isOverseasHubFullCatalogQueryKey(key)).toBe(false)
  })
})

describe('buildAirHotelHubBrowseQueryKey', () => {
  it('always includes type=air-hotel even when URL omits it', () => {
    const key = buildAirHotelHubBrowseQueryKey('scope=overseas')
    expect(key).toContain('type=air-hotel')
    expect(key).toContain('scope=overseas')
    expect(key).toContain('limit=10000')
  })
})

describe('normalizeAirHotelHubUrlSearchParams', () => {
  it('fills defaults and coerces bad type', () => {
    const n = normalizeAirHotelHubUrlSearchParams(new URLSearchParams('type=travel'))
    expect(n.get('scope')).toBe('overseas')
    expect(n.get('type')).toBe('air-hotel')
  })
})

describe('isOverseasHubFullCatalogQueryKey', () => {
  it('matches hub catalog fetch key', () => {
    expect(isOverseasHubFullCatalogQueryKey(buildOverseasHubCatalogFetchQueryKey())).toBe(true)
  })

  it('rejects region-filtered overseas queries', () => {
    expect(isOverseasHubFullCatalogQueryKey('limit=10000&region=japan&scope=overseas')).toBe(false)
  })
})

describe('overseasHubUrlNeedsServerGeoFetch', () => {
  it('false for region-only and bare overseas', () => {
    expect(overseasHubUrlNeedsServerGeoFetch('scope=overseas')).toBe(false)
    expect(overseasHubUrlNeedsServerGeoFetch('scope=overseas&region=japan')).toBe(false)
  })

  it('true for mid menuGroup and city leaf', () => {
    expect(
      overseasHubUrlNeedsServerGeoFetch(
        'scope=overseas&region=japan&country=japan&menuGroup=kansai',
      ),
    ).toBe(true)
    expect(
      overseasHubUrlNeedsServerGeoFetch(
        'scope=overseas&region=japan&country=japan&menuGroup=kansai&city=osaka',
      ),
    ).toBe(true)
  })

  it('true for country and sports theme', () => {
    expect(overseasHubUrlNeedsServerGeoFetch('scope=overseas&region=southeast-asia&country=thailand')).toBe(
      true,
    )
    expect(overseasHubUrlNeedsServerGeoFetch('scope=overseas&region=sports_theme&sportsTheme=2030')).toBe(
      true,
    )
  })

  it('uses geo-focused limit 500 for mid/leaf browse keys', () => {
    const key = buildOverseasHubBrowseQueryKey(
      'scope=overseas&region=japan&country=japan&menuGroup=kansai',
    )
    expect(key).toContain('limit=500')
    expect(key).toContain('menuGroup=kansai')
    expect(key).not.toContain('limit=10000')
  })
})
