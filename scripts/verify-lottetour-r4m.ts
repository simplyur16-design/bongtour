/**
 * R-4-M 스모크: 공개 consumption 모듈 키·lottetour 전용 공개 표시·쇼핑 resolution.
 * 실행: npx tsx scripts/verify-lottetour-r4m.ts
 */
import assert from 'node:assert/strict'
import type { DepartureKeyFacts } from '../lib/departure-key-facts'
import {
  sanitizeLottetourPublicDepartureKeyFacts,
  sanitizeLottetourPublicProductAirlineLine,
} from '../lib/lottetour-product-public-display'
import { resolveShoppingConsumption } from '../lib/public-consumption-lottetour'
import { resolvePublicConsumptionModuleKey } from '../lib/resolve-public-consumption-module-key'

assert.equal(resolvePublicConsumptionModuleKey('lottetour', null), 'lottetour')
assert.equal(resolvePublicConsumptionModuleKey(null, 'lottetour'), 'lottetour')

const emptyShop = resolveShoppingConsumption({
  canonical: {},
  legacyDbRows: [],
  legacyMetaRows: [],
})
assert.equal(emptyShop.source, 'none')
assert.equal(emptyShop.value.length, 0)

const facts: DepartureKeyFacts = {
  airline: '  예정  ',
  outbound: null,
  inbound: null,
  outboundSummary: null,
  inboundSummary: null,
  meetingSummary: null,
}
const scrubbed = sanitizeLottetourPublicDepartureKeyFacts(facts)
assert.equal(scrubbed.airline, null)

assert.equal(sanitizeLottetourPublicProductAirlineLine('항공예정'), null)

console.log('verify-lottetour-r4m: ok')
