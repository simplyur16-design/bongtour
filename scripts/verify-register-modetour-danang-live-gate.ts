/**
 * 모두투어 다낭 AVP623(103887821) — 선택관광·쇼핑 API + 미리보기 live gate.
 * REGRESSION-FREEZE[modetour-register-danang-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-modetour-danang-live-gate.ts
 */
import assert from 'node:assert/strict'
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'

const URL = 'https://www.modetour.com/package/103887821'

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
    hasOptionalTour: false,
    includedItems: ['왕복 항공료'],
    excludedItems: ['가이드/기사 경비'],
  } as RegisterParsed

  const parsed = await augmentModetourParsedWithDetailCollect(base, { originUrl: URL })
  assert.ok(registerFlightCollectLooksComplete(parsed), 'modetour flight: airline·편명·시간')
  assert.ok(parsed.airlineName?.trim(), 'modetour airline name')
  assert.match(parsed.outboundFlightNo ?? '', /VJ879/i, 'modetour outbound flight no')
  assert.match(parsed.inboundFlightNo ?? '', /VJ878/i, 'modetour inbound flight no')
  const optN = countJsonRows(parsed.optionalToursStructured)
  const shopN = countJsonRows(parsed.shoppingStops)
  assert.ok(optN >= 15, `modetour optional rows >= 15 (got ${optN})`)
  assert.ok(shopN >= 3, `modetour shopping rows >= 3 (got ${shopN})`)
  assert.equal(parsed.hasOptionalTour, true)
  assert.ok((parsed.shoppingVisitCount ?? 0) >= 3, 'shopping visit count >= 3')

  const card = buildRegisterAdminPreviewCardData({
    parsed,
    productDraft: { title: parsed.title ?? '', duration: parsed.duration ?? '', priceFrom: 0 },
    schedule: parsed.schedule ?? [],
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(card.optionalTours.length >= 15, `preview optional >= 15 (got ${card.optionalTours.length})`)
  assert.ok(card.shoppingItems.length >= 3, `preview shopping >= 3 (got ${card.shoppingItems.length})`)
  assert.ok(card.optionalTours.some((o) => /바나힐/i.test(o.name)), '바나힐 optional in preview')
  assert.ok(card.shoppingItems.some((s) => /노니/i.test(s.itemName)), '노니 shopping in preview')

  console.log('OK modetour 103887821 Danang live gate', {
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
