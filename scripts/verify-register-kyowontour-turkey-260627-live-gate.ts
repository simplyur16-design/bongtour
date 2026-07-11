/**
 * 교원이지 ECP102260627OZ01 — 신규 등록 SSOT full parse live gate.
 * 포함/불포함·옵션·쇼핑·항공·잔여석·일정(routeText a-g·description)·imageKeyword 슬롯.
 *
 * REGRESSION-FREEZE[kyowontour-register-turkey-260627-live-gate]: manifest
 * npx tsx scripts/verify-register-kyowontour-turkey-260627-live-gate.ts
 */
import assert from 'node:assert/strict'
import { parseKyowontourRegisterFromApi } from '@/lib/kyowontour-register-api-parse'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { LOTTETOUR_SCHEDULE_ROUTE_MAX } from '@/lib/lottetour-register-api-schedule'

const URL =
  'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=ECP102260627OZ01&menuCode=M510105&brandId=0'

function countJsonRows(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function normKw(kw: string | null | undefined): string {
  return String(kw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function assertScheduleImageKeywordSlots(
  schedule: { day: number; imageKeyword?: string | null; imageKeyword2?: string | null }[],
): void {
  const rows = schedule.filter((d) => Number(d.day) > 0).sort((a, b) => a.day - b.day)
  const maxDay = rows.length ? Math.max(...rows.map((r) => r.day)) : 0
  const used = new Set<string>()

  for (const row of rows) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, rows.length)
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    const route = String(row.routeText ?? '').trim()
    const hotelOnlyRoute = /^호텔$/i.test(route) || /^hotel$/i.test(route)

    if (slot === 'departure' || slot === 'return') {
      if (!kw.length && slot === 'return' && /인천|ICN|공항/i.test(route)) continue
      assert.ok(kw.length > 0, `day${day} (${slot}) imageKeyword required`)
      assert.equal(kw2, '', `day${day} (${slot}) imageKeyword2 must be empty`)
    } else {
      if (hotelOnlyRoute && !kw) continue
      assert.ok(kw.length > 0, `day${day} (middle) imageKeyword required`)
    }

    for (const k of [kw, kw2].filter(Boolean)) {
      const nk = normKw(k)
      assert.ok(nk.length > 0, `day${day} empty keyword`)
      assert.ok(!used.has(nk), `day${day} keyword reuse: ${k}`)
      used.add(nk)
    }
  }
}

function assertScheduleRouteAndDescription(
  schedule: { day: number; routeText?: string | null; description?: string | null }[],
): void {
  for (const row of schedule) {
    const route = String(row.routeText ?? '').trim()
    if (!route) continue
    const parts = route.split(/\s*-\s*/).filter(Boolean)
    assert.ok(parts.length >= 1, `day${row.day} routeText empty segments`)
    assert.ok(parts.length <= LOTTETOUR_SCHEDULE_ROUTE_MAX, `day${row.day} routeText > ${LOTTETOUR_SCHEDULE_ROUTE_MAX} places`)

    const maxDay = schedule.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
    const isMiddleTourDay = row.day >= 2 && row.day <= maxDay - 1
    const hotelOnly = /^(?:호텔|hotel)$/i.test(route)
    if (isMiddleTourDay && !hotelOnly) {
      assert.ok(parts.length >= 2, `day${row.day} middle day routeText must be a-b chain (got "${route.slice(0, 80)}")`)
    }

    const desc = String(row.description ?? '').trim()
    assert.ok(desc.length > 0, `day${row.day} description empty`)
    assert.notEqual(desc, route, `day${row.day} description must not copy routeText`)
    const sentenceCount = desc.split(/[.!?]\s+/).filter((s) => s.length > 8).length
    assert.ok(sentenceCount >= 1 && sentenceCount <= 4, `day${row.day} vibe sentence count ${sentenceCount}`)
    assert.ok(desc.length <= 320, `day${row.day} vibe too long`)
  }
}

async function main() {
  const parsed = await parseKyowontourRegisterFromApi('', 'kyowontour', { originUrl: URL })

  assert.equal(parsed.originCode, 'ECP102260627OZ01')
  assert.ok((parsed.title ?? '').includes('튀르키예'), `title must be product name (got ${parsed.title?.slice(0, 60)})`)

  assert.ok((parsed.includedItems?.length ?? 0) >= 3, `included >= 3 (got ${parsed.includedItems?.length})`)
  assert.ok((parsed.excludedItems?.length ?? 0) >= 2, `excluded >= 2 (got ${parsed.excludedItems?.length})`)

  assert.ok(registerFlightCollectLooksComplete(parsed), 'flight: airline·편명·시간')
  assert.match(parsed.outboundFlightNo ?? '', /OZ551/i)
  assert.match(parsed.inboundFlightNo ?? '', /OZ552/i)
  assert.ok(parsed.airlineName?.includes('아시아나'), 'airline 아시아나항공')

  const optN = countJsonRows(parsed.optionalToursStructured)
  const shopN = countJsonRows(parsed.shoppingStops)
  assert.ok(optN >= 1, `optional rows >= 1 (got ${optN})`)
  assert.ok(shopN >= 1, `shopping rows >= 1 (got ${shopN})`)
  assert.equal(parsed.hasOptionalTour, true)
  assert.ok((parsed.shoppingVisitCount ?? 0) >= 1, `shopping visit >= 1 (got ${parsed.shoppingVisitCount})`)

  assert.equal(parsed.remainingSeatsCount, 12, 'remainingSeatsCount from goodsEventDetail HTML')
  assert.ok(parsed.seatsStatusRaw?.includes('12'), 'seatsStatusRaw 잔여12석')

  const schedule = parsed.schedule ?? []
  assert.ok(schedule.length >= 7, `schedule days >= 7 (got ${schedule.length})`)
  assertScheduleRouteAndDescription(schedule)
  assertScheduleImageKeywordSlots(schedule)

  const card = buildRegisterAdminPreviewCardData({
    parsed,
    productDraft: { title: parsed.title ?? '', duration: parsed.duration ?? '', priceFrom: 0 },
    schedule,
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(card.includedItems.length >= 3, 'preview included')
  assert.ok(card.excludedItems.length >= 2, 'preview excluded')
  assert.ok(card.optionalTours.length >= 1, 'preview optional')
  assert.ok(card.shoppingItems.length >= 1, 'preview shopping')

  console.log('OK kyowontour ECP102260627OZ01 Turkey live gate', {
    originCode: parsed.originCode,
    title: parsed.title?.slice(0, 64),
    included: parsed.includedItems?.length,
    excluded: parsed.excludedItems?.length,
    airlineName: parsed.airlineName,
    outboundFlightNo: parsed.outboundFlightNo,
    inboundFlightNo: parsed.inboundFlightNo,
    remainingSeatsCount: parsed.remainingSeatsCount,
    seatsStatusRaw: parsed.seatsStatusRaw,
    optionalRows: optN,
    shoppingRows: shopN,
    scheduleDays: schedule.length,
    day2: schedule.find((d) => d.day === 2),
    detailCollect: parsed.kyowontourDetailCollectSummary,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
