/**
 * 내일투어 2AZZ3346 — 자유여행(air_hotel_free) 등록 live gate.
 * REGRESSION-FREEZE[naeiltour-register-2azz3346-airtel-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-naeiltour-2azz3346-airtel-live-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { parseNaeiltourRegisterFromApi } from '@/lib/naeiltour-register-api-parse'
import { augmentNaeiltourScheduleExpressionParsed } from '@/lib/parse-and-register-naeiltour-schedule'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { AIR_HOTEL_PRODUCT_TYPE } from '@/lib/air-hotel-product-ssot'

const URL = 'https://www.naeiltour.co.kr/sub/view.asp?good_cd=2AZZ3346&sub_area_cd='

async function main() {
  console.log('=== verify-register-naeiltour-2azz3346-airtel-live-gate ===\n')

  const parsed = await parseNaeiltourRegisterFromApi('', 'naeiltour', {
    originUrl: URL,
    travelScope: 'air_hotel_free',
  })

  assert.match(parsed.originCode ?? parsed.goodCd ?? '', /2AZZ3346/i, 'good_cd')
  assert.match(parsed.title ?? '', /싱가|마리나|금까기|자유/i, `title looks like airtel product (got ${parsed.title?.slice(0, 80)})`)
  assert.equal(parsed.schedule?.length ?? 0, 0, 'airtel parse must skip package tab1 schedule')
  assert.ok((parsed.includedItems?.length ?? 0) >= 2, `included >= 2 (got ${parsed.includedItems?.length})`)
  assert.ok((parsed.excludedItems?.length ?? 0) >= 1, `excluded >= 1 (got ${parsed.excludedItems?.length})`)
  assert.ok(
    registerFlightCollectLooksComplete(parsed) ||
      Boolean(parsed.outboundFlightNo && parsed.inboundFlightNo) ||
      Boolean(parsed.includedText?.includes('항공')),
    'flight or included mentions air ticket',
  )

  let next = augmentNaeiltourScheduleExpressionParsed(parsed, '', { travelScope: 'air_hotel_free' })
  assert.equal(next.schedule?.length ?? 0, 0, 'augment must not inject package schedule for airtel')

  next = await applyRegisterPostAugmentSchedulePipeline(next, {
    travelScope: 'air_hotel_free',
    forcedBrandKey: 'naeiltour',
    mode: 'preview',
    hasPersistedParsed: false,
  })

  assert.equal(next.productType, AIR_HOTEL_PRODUCT_TYPE, 'productType stamped airtel')
  const fitSchedule = next.schedule ?? []
  assert.ok(fitSchedule.length >= 3, `fit schedule days >= 3 (got ${fitSchedule.length})`)
  for (const row of fitSchedule) {
    assert.ok(String(row.imageKeyword ?? '').trim().length > 0, `day${row.day} fit imageKeyword`)
  }
  assert.ok(next.registerFitItineraryGeminiJson?.trim(), 'registerFitItineraryGeminiJson persisted')

  console.log('[ok] title:', parsed.title?.slice(0, 100))
  console.log('[ok] duration:', parsed.duration)
  console.log('[ok] included sample:', parsed.includedItems?.slice(0, 3).join(' | '))
  console.log('[ok] flight:', parsed.outboundFlightNo, parsed.inboundFlightNo, parsed.airlineName)
  console.log('[ok] fit schedule days:', fitSchedule.length)
  for (const row of fitSchedule) {
    console.log(`[ok] fit day${row.day}: ${row.title?.slice(0, 48)} → kw: ${row.imageKeyword}`)
  }
  console.log('\nPASSED: naeiltour 2AZZ3346 airtel live gate')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
