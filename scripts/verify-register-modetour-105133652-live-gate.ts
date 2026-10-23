/**
 * modetour 105133652 — 항공+호텔(자유여행) live gate.
 * REGRESSION-FREEZE[modetour-105133652-live-gate]: manifest
 * URL: https://www.modetour.com/package/105133652
 *
 * SSOT: 관리자 travelScope=air_hotel_free 선택(추론 없음).
 *
 * npx tsx scripts/verify-register-modetour-105133652-live-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { parseFitItineraryGeminiJson } from '@/lib/fit-itinerary-gemini-parse'
import { buildRegisterAirHotelItineraryDayDrafts } from '@/lib/register-air-hotel-itinerary-day-drafts'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
import { parseModetourRegisterFromApi } from '@/lib/modetour-register-api-parse'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { isModetourAlphaOriginCode } from '@/lib/register-facts/modetour'

const PRODUCT_NO = '105133652'
const URL = `https://www.modetour.com/package/${PRODUCT_NO}`
const TRAVEL_SCOPE = 'air_hotel_free'

function assertItineraryHasPracticalContent(
  drafts: Array<{ summaryTextRaw?: string | null; meals?: string | null; transport?: string | null }>,
): void {
  const blob = drafts
    .map((d) => [d.summaryTextRaw, d.meals, d.transport].join('\n'))
    .join('\n')
  assert.match(blob, /이동|택시|버스|transport|원|₩|엔|비용|cost/i, '이동·비용 정보')
  assert.match(blob, /먹|음식|식당|meal|메뉴|소바|스테이크|sushi|ramen|soba|steak|맛보/i, '먹거리 추천')
}

async function main() {
  const skeleton = await parseModetourRegisterFromApi('', 'modetour', {
    originUrl: URL,
    travelScope: TRAVEL_SCOPE,
  })
  // originCode는 URL 단체번호가 아니라 detail.productCode2다 (숫자 폴백도 허용).
  assert.ok(
    skeleton.originCode === PRODUCT_NO || isModetourAlphaOriginCode(skeleton.originCode),
    `originCode productCode2 or URL productNo, got ${skeleton.originCode}`,
  )

  const parsed = await applyRegisterPostAugmentSchedulePipeline(skeleton, {
    travelScope: TRAVEL_SCOPE,
    forcedBrandKey: 'modetour',
    logPrefix: 'verify-modetour-105133652',
    mode: 'preview',
  })

  assert.ok(registerFlightCollectLooksComplete(parsed), 'flight collect complete')
  assert.equal(parsed.productType, 'air-hotel')
  const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!geminiKey) {
    console.log(`SKIP fit gemini modetour ${PRODUCT_NO} — GEMINI_API_KEY unset`)
    return
  }
  assert.ok(parsed.registerFitItineraryGeminiJson?.trim(), 'registerFitItineraryGeminiJson')

  const drafts = buildRegisterAirHotelItineraryDayDrafts(parsed)
  assert.ok(drafts.length >= 3, `itinerary drafts >= 3 (got ${drafts.length})`)
  assertItineraryHasPracticalContent(drafts)

  const fit = parseFitItineraryGeminiJson(parsed.registerFitItineraryGeminiJson!)
  assert.ok((fit.days?.length ?? 0) >= 3, 'Fit days')

  console.log(`OK modetour ${PRODUCT_NO} air_hotel_free (admin-selected)`, {
    title: parsed.title,
    fitDays: fit.days.length,
    draftSample: drafts[0]?.summaryTextRaw?.slice(0, 120),
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
