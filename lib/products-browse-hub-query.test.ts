import { describe, expect, it } from 'vitest'
import {
  buildOverseasHubCatalogFetchQueryKey,
  isOverseasHubFullCatalogQueryKey,
} from '@/lib/products-browse-hub-query'

describe('isOverseasHubFullCatalogQueryKey', () => {
  it('matches hub catalog fetch key', () => {
    expect(isOverseasHubFullCatalogQueryKey(buildOverseasHubCatalogFetchQueryKey())).toBe(true)
  })

  it('rejects region-filtered overseas queries', () => {
    expect(isOverseasHubFullCatalogQueryKey('limit=10000&region=japan&scope=overseas')).toBe(false)
  })
})
