/**
 * 롯데관광 하문 C11A260707KE015 — 항공·선택관광·쇼핑·imageKeyword2 live gate.
 * REGRESSION-FREEZE[lottetour-register-xiamen-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-lottetour-xiamen-live-gate.ts
 */
import assert from 'node:assert/strict'
import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'

const URL =
  'https://www.lottetour.com/evtDetail/826/858/1700/3857?evtCd=C11A260707KE015'

function countJsonRows(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

async function main() {
  const base: RegisterParsed = {
    originUrl: URL,
    title: 'Y2627 호텔 UPGRADE 하문(샤먼),고랑서 4박 5일 메리어트 하이창',
    hasOptionalTour: false,
    hasShopping: false,
    schedule: [
      { day: 1, title: '인천 출발', description: '인천 출발', imageKeyword: 'Incheon' },
      { day: 2, title: '고랑서', description: '고랑서 관광', imageKeyword: 'Gulangyu Island', routeText: '하문 - 고랑서' },
      { day: 3, title: '하문', description: '시내 관광', imageKeyword: 'Nanputuo Temple', routeText: '하문' },
      { day: 4, title: '자유일', description: '자유일', imageKeyword: 'Zhongshan Road', routeText: '하문' },
      { day: 5, title: '귀국', description: '인천 귀국', imageKeyword: 'Fuzhou', routeText: '하문 - 복주 - 인천' },
    ],
  } as RegisterParsed

  const parsed = await augmentLottetourParsedWithDetailCollect(base, { originUrl: URL })
  assert.ok(registerFlightCollectLooksComplete(parsed), 'lottetour flight: airline·편명·시간')
  assert.match(parsed.outboundFlightNo ?? '', /KE127/i)
  assert.match(parsed.inboundFlightNo ?? '', /KE128/i)
  assert.ok(parsed.airlineName?.includes('대한항공'), 'airline 대한항공')

  const optN = countJsonRows(parsed.optionalToursStructured)
  const shopN = countJsonRows(parsed.shoppingStops)
  assert.ok(optN >= 7, `optional rows >= 7 (got ${optN})`)
  assert.ok(shopN >= 3, `shopping rows >= 3 (got ${shopN})`)
  assert.equal(parsed.hasOptionalTour, true)
  assert.ok((parsed.shoppingVisitCount ?? 0) >= 2, 'shopping visit count >= 2')

  const d2 = parsed.schedule?.find((d) => d.day === 2)
  assert.ok((d2?.imageKeyword ?? '').length > 0, 'day2 imageKeyword')
  assert.ok((d2?.imageKeyword2 ?? '').length > 0, 'day2 imageKeyword2')

  const card = buildRegisterAdminPreviewCardData({
    parsed,
    productDraft: { title: parsed.title ?? '', duration: parsed.duration ?? '', priceFrom: 0 },
    schedule: parsed.schedule ?? [],
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(card.optionalTours.length >= 7, `preview optional >= 7 (got ${card.optionalTours.length})`)
  assert.ok(card.shoppingItems.length >= 3, `preview shopping >= 3 (got ${card.shoppingItems.length})`)
  assert.ok(card.optionalTours.some((o) => /서커스/i.test(o.name)), '서커스 optional in preview')

  console.log('OK lottetour C11A260707KE015 Xiamen live gate', {
    airlineName: parsed.airlineName,
    outboundFlightNo: parsed.outboundFlightNo,
    inboundFlightNo: parsed.inboundFlightNo,
    optionalRows: optN,
    shoppingRows: shopN,
    day2: { kw1: d2?.imageKeyword, kw2: d2?.imageKeyword2 },
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
