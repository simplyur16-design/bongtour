import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { countrySlugFromLabel } from '../lib/location-url-slugs'
import {
  resolveBrowseCountryParamToCountryKeySlugs,
  resolveBrowseCountryParamToDbCountries,
} from '../lib/browse-country-url-resolve'
import { buildProductsHrefCountryOnly } from '../lib/top-nav-resolve'
import { TOP_NAV_MEGA_REGIONS } from '../lib/top-nav-resolve'

describe('mega menu — 인도 browse slug', () => {
  it('countrySlugFromLabel maps 인도 → india', () => {
    assert.equal(countrySlugFromLabel('인도'), 'india')
  })

  it('browse resolves india master countryKey', () => {
    assert.deepEqual(resolveBrowseCountryParamToDbCountries('india'), ['인도'])
    assert.ok(resolveBrowseCountryParamToCountryKeySlugs('india').includes('india'))
    assert.ok(resolveBrowseCountryParamToCountryKeySlugs('인도').includes('india'))
  })

  it('mega menu 인도 header href uses country=india', () => {
    const href = buildProductsHrefCountryOnly({
      type: 'travel',
      regionId: 'southeast-asia',
      countryLabel: '인도',
    })
    const url = new URL(href, 'https://bongtour.local')
    assert.equal(url.searchParams.get('country'), 'india')
    assert.equal(url.searchParams.get('menuGroup'), 'india')
  })

  it('southeast-asia tab includes 인도 group with country leaf', () => {
    const sea = TOP_NAV_MEGA_REGIONS.find((r) => r.id === 'southeast-asia')
    const india = sea?.countryGroups?.find((g) => g.countryLabel === '인도')
    assert.ok(india)
    assert.ok(india!.cities.some((c) => c.label === '인도' && c.kind === 'country'))
    assert.ok(india!.cities.some((c) => c.label === '델리'))
  })
})
