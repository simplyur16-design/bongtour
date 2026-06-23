/**
 * ybtour 대만 CIP1107 — tour-detail 선택관광·shopInfo 쇼핑 + 미리보기 live gate.
 * REGRESSION-FREEZE[ybtour-register-taiwan-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-ybtour-taiwan-live-gate.ts
 */
import assert from 'node:assert/strict'
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'

const URL =
  'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AADC003&evCd=CIP1107-260624ZE00'

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
    title: '대만 3일 #천등날리기 #핵심관광지 #ZE #인천출발',
    hasOptionalTour: false,
    hasShopping: false,
    shoppingVisitCount: 0,
    shoppingSummaryText: '쇼핑 없음',
    includedItems: ['왕복 항공료'],
    excludedItems: ['가이드/기사 경비'],
    detailBodyStructured: {
      normalizedRaw: '선택관광 없음\n쇼핑 없음',
    },
  } as RegisterParsed

  const parsed = await augmentYbtourParsedWithDetailCollect(base, { originUrl: URL })
  assert.ok(registerFlightCollectLooksComplete(parsed), 'ybtour flight: airline·편명·시간')
  assert.ok(parsed.airlineName?.trim(), 'ybtour airline name')
  assert.ok(parsed.outboundFlightNo?.trim(), 'ybtour outbound flight no')
  assert.ok(parsed.inboundFlightNo?.trim(), 'ybtour inbound flight no')
  const optN = countJsonRows(parsed.optionalToursStructured)
  const shopN = countJsonRows(parsed.shoppingStops)
  assert.ok(optN >= 2, `ybtour optional rows >= 2 (got ${optN})`)
  assert.ok(shopN >= 2, `ybtour shopping rows >= 2 (got ${shopN})`)
  assert.equal(parsed.hasOptionalTour, true)
  assert.ok((parsed.shoppingVisitCount ?? 0) >= 2, `shopping visit count >= 2 (got ${parsed.shoppingVisitCount})`)

  const card = buildRegisterAdminPreviewCardData({
    parsed,
    productDraft: { title: parsed.title ?? '', duration: parsed.duration ?? '', priceFrom: 0 },
    schedule: parsed.schedule ?? [],
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(card.optionalTours.length >= 2, `preview optional >= 2 (got ${card.optionalTours.length})`)
  assert.ok(card.shoppingItems.length >= 2, `preview shopping >= 2 (got ${card.shoppingItems.length})`)
  assert.ok(card.optionalTours.some((o) => /101|빌딩/i.test(o.name)), '101 빌딩 optional in preview')
  assert.ok(card.shoppingItems.some((s) => /파인애플|과자/i.test(s.itemName)), '파인애플 shopping in preview')

  console.log('OK ybtour CIP1107 Taiwan live gate', {
    airlineName: parsed.airlineName,
    outboundFlightNo: parsed.outboundFlightNo,
    inboundFlightNo: parsed.inboundFlightNo,
    optionalRows: optN,
    shoppingRows: shopN,
    previewOptional: card.optionalTours.length,
    previewShopping: card.shoppingItems.length,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
