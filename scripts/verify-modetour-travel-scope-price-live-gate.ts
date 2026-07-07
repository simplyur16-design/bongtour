/**
 * modetour — admin travelScope vs URL 추론 live gate (패키지·자유여행 분리).
 * REGRESSION-FREEZE[register-travel-scope-origin-url-fit]: manifest
 *
 * npx tsx scripts/verify-modetour-travel-scope-price-live-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { resolveRegisterTravelScopeFromRequest } from '@/lib/register-admin-travel-category'
import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'
import { parseRegisterFactProductKind } from '@/lib/register-facts/product-kind'

/** 패키지형 — groupName에 에어텔/자유여행 힌트 없음 */
const PACKAGE_NO = '102104485'
const PACKAGE_URL = `https://www.modetour.com/package/${PACKAGE_NO}`

/** 자유여행형 */
const AIRTEL_NO = '105133652'
const AIRTEL_URL = `https://www.modetour.com/package/${AIRTEL_NO}`

async function main() {
  const scopePackage = resolveRegisterTravelScopeFromRequest({
    bodyTravelScope: 'overseas',
    originSource: 'modetour',
    originUrl: AIRTEL_URL,
    listingTitleHint: '[오사카 자유4일] 씨티루트 호텔급',
  })
  assert.equal(scopePackage, 'overseas', 'explicit overseas must win over airtel URL+title')

  const scopeAirtel = resolveRegisterTravelScopeFromRequest({
    bodyTravelScope: 'air_hotel_free',
    originSource: 'modetour',
    originUrl: PACKAGE_URL,
    listingTitleHint: null,
  })
  assert.equal(scopeAirtel, 'air_hotel_free', 'explicit air_hotel_free must win over package URL')

  const pkgFacts = await collectModetourRegisterFacts(PACKAGE_URL, { adminTravelScope: 'overseas' })
  assert.ok(pkgFacts, 'package facts')
  assert.equal(parseRegisterFactProductKind(pkgFacts!), 'package', 'package facts productKind')
  assert.ok(pkgFacts!.priceRows.length >= 1, 'package price rows')

  const airFacts = await collectModetourRegisterFacts(AIRTEL_URL, { adminTravelScope: 'air_hotel_free' })
  assert.ok(airFacts, 'airtel facts')
  assert.equal(parseRegisterFactProductKind(airFacts!), 'air_hotel_free', 'airtel facts productKind')
  assert.ok(airFacts!.priceRows.length >= 1, 'airtel price rows')

  console.log('OK modetour travelScope price live gate', {
    packageNo: PACKAGE_NO,
    packageRows: pkgFacts!.priceRows.length,
    packageKind: parseRegisterFactProductKind(pkgFacts!),
    airtelNo: AIRTEL_NO,
    airtelRows: airFacts!.priceRows.length,
    airtelKind: parseRegisterFactProductKind(airFacts!),
    scopePackage,
    scopeAirtel,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
