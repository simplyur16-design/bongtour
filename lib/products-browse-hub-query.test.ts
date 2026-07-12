import { describe, expect, it } from 'vitest'
import {
  buildOverseasHubBrowseQueryKey,
  buildOverseasHubCatalogFetchQueryKey,
  isOverseasHubFullCatalogQueryKey,
  overseasHubUrlNeedsServerGeoFetch,
} from '@/lib/products-browse-hub-query'

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
