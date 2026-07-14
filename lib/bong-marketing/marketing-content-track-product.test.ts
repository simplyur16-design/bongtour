/**
 * REGRESSION-FREEZE[marketing-content-track-product-gate]
 */
import { describe, expect, it } from 'vitest'
import {
  filterProductIdsByMarketingTrack,
  isAirtelMarketingProduct,
  isPackageMarketingProduct,
  pickLinkedProductIdForMarketingTrack,
} from '@/lib/bong-marketing/marketing-content-track-product'

describe('marketing content track product gate', () => {
  const pkg = { id: 'p1', listingKind: 'travel', productType: 'travel' }
  const legacyPkg = { id: 'p2', listingKind: null, productType: 'semi' }
  const fit = { id: 'a1', listingKind: 'air_hotel_free', productType: 'air-hotel' }
  const legacyFit = { id: 'a2', listingKind: null, productType: 'airtel' }
  const privateTrip = { id: 'pr1', listingKind: 'private_trip', productType: 'travel' }

  it('package track excludes FIT and private_trip', () => {
    expect(isPackageMarketingProduct(pkg)).toBe(true)
    expect(isPackageMarketingProduct(legacyPkg)).toBe(true)
    expect(isPackageMarketingProduct(fit)).toBe(false)
    expect(isPackageMarketingProduct(legacyFit)).toBe(false)
    expect(isPackageMarketingProduct(privateTrip)).toBe(false)
  })

  it('airtel track is FIT only', () => {
    expect(isAirtelMarketingProduct(fit)).toBe(true)
    expect(isAirtelMarketingProduct(legacyFit)).toBe(true)
    expect(isAirtelMarketingProduct(pkg)).toBe(false)
    expect(isAirtelMarketingProduct(privateTrip)).toBe(false)
  })

  it('pickLinkedProductIdForMarketingTrack skips wrong track at head of list', () => {
    const byId = new Map(
      [fit, pkg, legacyFit].map((p) => [p.id, p] as const),
    )
    expect(pickLinkedProductIdForMarketingTrack(['a1', 'p1'], byId, 'package')).toBe('p1')
    expect(pickLinkedProductIdForMarketingTrack(['a1', 'p1'], byId, 'airtel')).toBe('a1')
    expect(
      filterProductIdsByMarketingTrack(['a1', 'p1', 'a2'], byId, 'package'),
    ).toEqual(['p1'])
    expect(
      filterProductIdsByMarketingTrack(['a1', 'p1', 'a2'], byId, 'airtel'),
    ).toEqual(['a1', 'a2'])
  })
})
