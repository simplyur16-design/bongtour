/**
 * 모두투어 SSOT 9샘플 — register-facts API parse + detail-collect live gate.
 * REGRESSION-FREEZE[modetour-register-samples-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-modetour-samples-live-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { parseModetourRegisterFromApi } from '@/lib/modetour-register-api-parse'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'

function countJsonRows(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

type ModetourSample = {
  productNo: string
  minScheduleDays: number
  minOptionalTours: number
  minShoppingRows: number
  requireFlight: boolean
}

/** 운영자 지정 SSOT — URL https://www.modetour.com/package/{productNo} */
const SAMPLES: ModetourSample[] = [
  { productNo: '103887821', minScheduleDays: 4, minOptionalTours: 10, minShoppingRows: 2, requireFlight: true },
  { productNo: '104570994', minScheduleDays: 3, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '103964326', minScheduleDays: 3, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '102581108', minScheduleDays: 8, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '105519080', minScheduleDays: 9, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '104007990', minScheduleDays: 8, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '103621572', minScheduleDays: 4, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '101581103', minScheduleDays: 3, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
  { productNo: '96909579', minScheduleDays: 5, minOptionalTours: 0, minShoppingRows: 0, requireFlight: true },
]

function sampleUrl(productNo: string): string {
  return `https://www.modetour.com/package/${productNo}`
}

async function verifySample(sample: ModetourSample): Promise<void> {
  const url = sampleUrl(sample.productNo)
  const skeleton = await parseModetourRegisterFromApi('', 'modetour', { originUrl: url })
  assert.ok(skeleton.originCode === sample.productNo, `${sample.productNo}: originCode`)
  assert.ok(skeleton.title?.trim(), `${sample.productNo}: title`)
  assert.ok(
    (skeleton.schedule?.length ?? 0) >= sample.minScheduleDays,
    `${sample.productNo}: schedule >= ${sample.minScheduleDays} (got ${skeleton.schedule?.length ?? 0})`,
  )

  const parsed = await augmentModetourParsedWithDetailCollect(skeleton, { originUrl: url })
  assert.ok(parsed.modetourDetailCollectRan, `${sample.productNo}: detail collect ran`)

  if (sample.requireFlight) {
    assert.ok(
      registerFlightCollectLooksComplete(parsed),
      `${sample.productNo}: registerFlightCollectLooksComplete`,
    )
    assert.ok(parsed.outboundFlightNo?.trim(), `${sample.productNo}: outboundFlightNo`)
    assert.ok(parsed.inboundFlightNo?.trim(), `${sample.productNo}: inboundFlightNo`)
  }

  const optionalCount = countJsonRows(parsed.optionalToursStructured)
  if (sample.minOptionalTours > 0) {
    assert.ok(
      optionalCount >= sample.minOptionalTours,
      `${sample.productNo}: optional >= ${sample.minOptionalTours} (got ${optionalCount})`,
    )
  }

  const shopCount = countJsonRows(parsed.shoppingStops)
  if (sample.minShoppingRows > 0) {
    assert.ok(
      shopCount >= sample.minShoppingRows,
      `${sample.productNo}: shopping >= ${sample.minShoppingRows} (got ${shopCount})`,
    )
  }

  assert.ok((parsed.includedItems?.length ?? 0) >= 2, `${sample.productNo}: included items`)
  assert.ok((parsed.excludedItems?.length ?? 0) >= 1, `${sample.productNo}: excluded items`)
}

async function main() {
  for (const sample of SAMPLES) {
    await verifySample(sample)
    console.log(`ok modetour ${sample.productNo}`)
  }
  console.log(`modetour-register-samples-live-gate: ${SAMPLES.length}/${SAMPLES.length} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
