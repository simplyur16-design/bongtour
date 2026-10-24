/**
 * 내일투어 2AZZ3346 — 자유여행(air_hotel_free) 등록 live gate.
 * REGRESSION-FREEZE[naeiltour-register-2azz3346-airtel-live-gate]: manifest
 *
 * Gemini·공급사 실호출: LIVE_GATES=1 일 때만. 기본은 FIT Gemini fixture.
 *
 * npx tsx scripts/verify-register-naeiltour-2azz3346-airtel-live-gate.ts
 * LIVE_GATES=1 npx tsx scripts/verify-register-naeiltour-2azz3346-airtel-live-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseNaeiltourRegisterFromApi } from '@/lib/naeiltour-register-api-parse'
import { augmentNaeiltourScheduleExpressionParsed } from '@/lib/parse-and-register-naeiltour-schedule'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { AIR_HOTEL_PRODUCT_TYPE } from '@/lib/air-hotel-product-ssot'
import { parseFitItineraryGeminiJson } from '@/lib/fit-itinerary-gemini-parse'
import { buildRegisterAirHotelItineraryDayDrafts } from '@/lib/register-air-hotel-itinerary-day-drafts'
import { applyAirtelFitGeminiSkipUnlessLive, isLiveGatesEnabled } from './live-gate-mode'

const URL = 'https://www.naeiltour.co.kr/sub/view.asp?good_cd=2AZZ3346&sub_area_cd='
const FIXTURE = join(process.cwd(), 'scripts/fixtures/naeiltour-2azz3346-fit-gemini.json')

function assertFitFixturePath(): void {
  const geminiJson = readFileSync(FIXTURE, 'utf8')
  const fit = parseFitItineraryGeminiJson(geminiJson)
  assert.ok((fit.days?.length ?? 0) >= 3, 'Fit fixture days')
  const drafts = buildRegisterAirHotelItineraryDayDrafts({
    productType: AIR_HOTEL_PRODUCT_TYPE,
    title: 'naeiltour 2AZZ3346 fixture',
    registerFitItineraryGeminiJson: geminiJson,
  } as Parameters<typeof buildRegisterAirHotelItineraryDayDrafts>[0])
  assert.ok(drafts.length >= 3, `fixture drafts >= 3 (got ${drafts.length})`)
  for (const row of drafts) {
    assert.ok(String(row.summaryTextRaw ?? '').trim().length > 0, 'fixture day summary')
  }
  console.log('PASSED: naeiltour 2AZZ3346 airtel (fixture; LIVE_GATES≠1 — no Gemini/supplier call)')
}

async function main() {
  console.log('=== verify-register-naeiltour-2azz3346-airtel-live-gate ===\n')

  // REGRESSION-FREEZE[naeiltour-register-2azz3346-airtel-live-gate]: LIVE_GATES fixture default — manifest
  if (!isLiveGatesEnabled()) {
    assertFitFixturePath()
    return
  }

  applyAirtelFitGeminiSkipUnlessLive()
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
      Boolean(parsed.outboundFlightNo && parsed.inboundFlightNo && parsed.airlineName),
    'flight structured or leg hints',
  )
  assert.equal(parsed.outboundFlightNo, 'TW161', 'outbound flight')
  assert.equal(parsed.inboundFlightNo, 'TW162', 'inbound flight')
  assert.match(parsed.airlineName ?? '', /트리니티/, 'airline name')
  assert.match(parsed.title ?? '', /마리나베이샌즈/, 'title')
  assert.ok(!(parsed.title ?? '').includes('금까기'), 'title must omit 금까기')

  let next = augmentNaeiltourScheduleExpressionParsed(parsed, '', { travelScope: 'air_hotel_free' })
  assert.equal(next.schedule?.length ?? 0, 0, 'augment must not inject package schedule for airtel')

  next = await applyRegisterPostAugmentSchedulePipeline(next, {
    travelScope: 'air_hotel_free',
    forcedBrandKey: 'naeiltour',
    mode: 'preview',
    hasPersistedParsed: false,
  })

  assert.equal(next.productType, AIR_HOTEL_PRODUCT_TYPE, 'productType stamped airtel')
  const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!geminiKey) {
    console.log('SKIP fit gemini naeiltour 2AZZ3346 — LIVE_GATES=1 but GEMINI_API_KEY unset')
    return
  }
  const fitSchedule = next.schedule ?? []
  assert.ok(fitSchedule.length >= 3, `fit schedule days >= 3 (got ${fitSchedule.length})`)
  for (const row of fitSchedule) {
    assert.ok(String(row.imageKeyword ?? '').trim().length > 0, `day${row.day} fit imageKeyword`)
  }
  assert.ok(next.registerFitItineraryGeminiJson?.trim(), 'registerFitItineraryGeminiJson persisted')

  console.log('\nPASSED: naeiltour 2AZZ3346 airtel live gate (LIVE_GATES=1)')
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e)
  console.error('[live-gate] failed:', msg.slice(0, 400))
  process.exit(1)
})
