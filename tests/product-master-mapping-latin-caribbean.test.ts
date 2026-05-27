import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapTreeKeysToMasterKeys } from '../lib/product-master-mapping'

describe('mapTreeKeysToMasterKeys — latin-caribbean / sports-tours FK alignment', () => {
  it('cuba-mexico leaf defaults to mexico (seed parity)', () => {
    const r = mapTreeKeysToMasterKeys({
      groupKey: 'americas',
      countryKey: 'latin-caribbean',
      nodeKey: 'cuba-mexico',
    })
    assert.equal(r.masterCountryKey, 'mexico')
    assert.ok(r.reasons.includes('cuba_mexico_leaf_resolved'))
  })

  it('cuba-mexico leaf with cuba destination hint → cuba', () => {
    const r = mapTreeKeysToMasterKeys({
      groupKey: 'americas',
      countryKey: 'latin-caribbean',
      nodeKey: 'cuba-mexico',
      destinationHint: '쿠바 아바나',
    })
    assert.equal(r.masterCountryKey, 'cuba')
  })

  it('latin-caribbean country-only (no leaf) → masterCountryKey null', () => {
    const r = mapTreeKeysToMasterKeys({
      groupKey: 'americas',
      countryKey: 'latin-caribbean',
    })
    assert.equal(r.masterCountryKey, null)
    assert.ok(r.reasons.includes('tree_country_requires_nodekey'))
  })

  it('south-america multi leaf → masterCountryKey null (guard path)', () => {
    const r = mapTreeKeysToMasterKeys({
      groupKey: 'americas',
      countryKey: 'latin-caribbean',
      nodeKey: 'south-america',
    })
    assert.equal(r.masterCountryKey, null)
    assert.ok(r.reasons.includes('ambiguous_multi_country_leaf'))
  })

  it('caribbean leaf → dominican-republic unchanged', () => {
    const r = mapTreeKeysToMasterKeys({
      groupKey: 'americas',
      countryKey: 'latin-caribbean',
      nodeKey: 'caribbean',
    })
    assert.equal(r.masterCountryKey, 'dominican-republic')
  })

  it('sports-tours theme country → masterCountryKey null', () => {
    const r = mapTreeKeysToMasterKeys({
      groupKey: 'americas',
      countryKey: 'sports-tours',
      nodeKey: 'sports',
    })
    assert.equal(r.masterCountryKey, null)
    assert.ok(r.reasons.includes('theme_or_multi_country_tree'))
  })
})
