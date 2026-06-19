import { describe, expect, it } from 'vitest'
import {
  isSingleDepartureAdminCheckboxDisabled,
  isSingleDepartureProduct,
  parseSingleDepartureOnlyFromAdminBody,
  resolveSingleDepartureOnlyForAdminWrite,
  SINGLE_DEPARTURE_ADMIN_BODY_KEY,
} from '@/lib/single-departure-product-ssot'

describe('parseSingleDepartureOnlyFromAdminBody', () => {
  it('returns false when absent or falsy', () => {
    expect(parseSingleDepartureOnlyFromAdminBody({})).toBe(false)
    expect(parseSingleDepartureOnlyFromAdminBody({ [SINGLE_DEPARTURE_ADMIN_BODY_KEY]: false })).toBe(false)
    expect(parseSingleDepartureOnlyFromAdminBody({ [SINGLE_DEPARTURE_ADMIN_BODY_KEY]: 'false' })).toBe(false)
  })

  it('accepts boolean, string, and numeric truthy admin values', () => {
    expect(parseSingleDepartureOnlyFromAdminBody({ [SINGLE_DEPARTURE_ADMIN_BODY_KEY]: true })).toBe(true)
    expect(parseSingleDepartureOnlyFromAdminBody({ [SINGLE_DEPARTURE_ADMIN_BODY_KEY]: 'true' })).toBe(true)
    expect(parseSingleDepartureOnlyFromAdminBody({ [SINGLE_DEPARTURE_ADMIN_BODY_KEY]: 1 })).toBe(true)
    expect(parseSingleDepartureOnlyFromAdminBody({ [SINGLE_DEPARTURE_ADMIN_BODY_KEY]: '1' })).toBe(true)
  })
})

describe('isSingleDepartureProduct', () => {
  it('is true only when singleDepartureOnly is strictly true', () => {
    expect(isSingleDepartureProduct({ singleDepartureOnly: true })).toBe(true)
    expect(isSingleDepartureProduct({ singleDepartureOnly: false })).toBe(false)
    expect(isSingleDepartureProduct({})).toBe(false)
    expect(isSingleDepartureProduct({ singleDepartureOnly: null })).toBe(false)
  })
})

describe('isSingleDepartureAdminCheckboxDisabled', () => {
  it('disables for register travelScope air_hotel_free', () => {
    expect(isSingleDepartureAdminCheckboxDisabled({ travelScope: 'air_hotel_free' })).toBe(true)
  })

  it('disables for product listingKind air_hotel_free', () => {
    expect(isSingleDepartureAdminCheckboxDisabled({ listingKind: 'air_hotel_free' })).toBe(true)
  })

  it('allows overseas travel packages', () => {
    expect(
      isSingleDepartureAdminCheckboxDisabled({
        travelScope: 'overseas',
        listingKind: 'travel',
        productType: 'travel',
      }),
    ).toBe(false)
  })
})

describe('resolveSingleDepartureOnlyForAdminWrite', () => {
  it('forces false when air hotel even if body requests true', () => {
    expect(
      resolveSingleDepartureOnlyForAdminWrite(
        { singleDepartureOnly: true, listingKind: 'air_hotel_free' },
        { singleDepartureOnly: false, listingKind: 'travel', productType: 'travel' },
      ),
    ).toBe(false)
  })

  it('parses true from PATCH body for travel packages', () => {
    expect(
      resolveSingleDepartureOnlyForAdminWrite(
        { singleDepartureOnly: true },
        { singleDepartureOnly: false, listingKind: 'travel', productType: 'travel' },
      ),
    ).toBe(true)
  })

  it('keeps existing flag when body omits field', () => {
    expect(
      resolveSingleDepartureOnlyForAdminWrite(
        {},
        { singleDepartureOnly: true, listingKind: 'travel', productType: 'travel' },
      ),
    ).toBe(true)
  })
})
