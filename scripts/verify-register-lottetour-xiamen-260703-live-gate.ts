/**
 * 롯데관광 C11A260703KE006 — 신규 등록 SSOT full parse live gate.
 * 포함/불포함·옵션·쇼핑·항공·잔여석·일정(routeText a-g·description)·imageKeyword 슬롯.
 *
 * REGRESSION-FREEZE[lottetour-register-xiamen-260703-live-gate]: manifest
 * npx tsx scripts/verify-register-lottetour-xiamen-260703-live-gate.ts
 */
import assert from 'node:assert/strict'
import { parseLottetourRegisterFromApi } from '@/lib/lottetour-register-api-parse'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { LOTTETOUR_SCHEDULE_ROUTE_MAX } from '@/lib/lottetour-register-api-schedule'

const URL =
  'https://www.lottetour.com/evtDetail/826/858/3604/5603?evtCd=C11A260703KE006'

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

    if (slot === 'departure' || slot === 'return') {
      assert.ok(kw.length > 0, `day${day} (${slot}) imageKeyword required`)
      assert.equal(kw2, '', `day${day} (${slot}) imageKeyword2 must be empty`)
    } else {
      assert.ok(kw.length > 0, `day${day} (middle) imageKeyword required`)
    }

    for (const k of [kw, kw2].filter(Boolean)) {
      const nk = normKw(k)
      assert.ok(nk.length > 0, `day${day} empty keyword`)
      assert.ok(!used.has(nk), `day${day} keyword reuse: ${k}`)
      used.add(nk)
    }
  }

  let expectedSlots = 0
  for (const row of rows) {
    const slot = resolveScheduleKeywordSlotKind(row.day, maxDay, rows.length)
    expectedSlots += slot === 'middle' ? 2 : 1
  }
  const filled = rows.reduce(
    (n, r) => n + (r.imageKeyword?.trim() ? 1 : 0) + (r.imageKeyword2?.trim() ? 1 : 0),
    0,
  )
  assert.equal(filled, expectedSlots, `imageKeyword slot count ${filled} !== ${expectedSlots}`)
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

    const desc = String(row.description ?? '').trim()
    assert.ok(desc.length > 0, `day${row.day} description empty`)
    assert.notEqual(desc, route, `day${row.day} description must not copy routeText`)
    const sentenceCount = desc.split(/[.!?]\s+/).filter((s) => s.length > 8).length
    assert.ok(sentenceCount >= 1 && sentenceCount <= 4, `day${row.day} vibe sentence count ${sentenceCount}`)
    assert.ok(desc.length <= 320, `day${row.day} vibe too long`)
  }
}

async function main() {
  const parsed = await parseLottetourRegisterFromApi('', 'lottetour', { originUrl: URL })

  assert.equal(parsed.evtCd, 'C11A260703KE006')
  assert.ok(parsed.godId?.trim(), 'godId resolved from evtDetail HTML')
  assert.ok((parsed.title ?? '').length > 10, 'title')

  assert.ok((parsed.includedItems?.length ?? 0) >= 3, `included >= 3 (got ${parsed.includedItems?.length})`)
  assert.ok((parsed.excludedItems?.length ?? 0) >= 2, `excluded >= 2 (got ${parsed.excludedItems?.length})`)
  assert.ok(parsed.includedItems?.some((x) => /항공|숙박|보험/i.test(x)), 'included 항공·숙박·보험')
  assert.ok(parsed.excludedItems?.some((x) => /가이드|경비|선택관광/i.test(x)), 'excluded 가이드·선택관광')

  assert.ok(registerFlightCollectLooksComplete(parsed), 'flight: airline·편명·시간')
  assert.match(parsed.outboundFlightNo ?? '', /KE125/i)
  assert.match(parsed.inboundFlightNo ?? '', /KE126/i)
  assert.ok(parsed.airlineName?.includes('대한항공'), 'airline 대한항공')

  const optN = countJsonRows(parsed.optionalToursStructured)
  const shopN = countJsonRows(parsed.shoppingStops)
  assert.ok(optN >= 1, `optional rows >= 1 (got ${optN})`)
  assert.ok(shopN >= 1, `shopping rows >= 1 (got ${shopN})`)
  assert.equal(parsed.hasOptionalTour, true)
  assert.ok((parsed.shoppingVisitCount ?? 0) >= 1, `shopping visit >= 1 (got ${parsed.shoppingVisitCount})`)

  assert.ok(parsed.remainingSeatsCount != null, 'remainingSeatsCount from evtListAjax API')
  assert.ok(
    parsed.seatsStatusRaw?.includes('석') || parsed.remainingSeatsCount != null,
    'seatsStatusRaw or remainingSeatsCount',
  )

  const schedule = parsed.schedule ?? []
  assert.ok(schedule.length >= 3, `schedule days >= 3 (got ${schedule.length})`)
  assertScheduleRouteAndDescription(schedule)
  assertScheduleImageKeywordSlots(schedule)

  const anchorPrice = parsed.prices?.find((p) => p.departureDate?.includes('2026-07-03'))
  assert.ok(anchorPrice != null || (parsed.prices?.length ?? 0) >= 1, 'calendar price rows')

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

  console.log('OK lottetour C11A260703KE006 Xiamen live gate', {
    godId: parsed.godId,
    evtCd: parsed.evtCd,
    title: parsed.title?.slice(0, 64),
    included: parsed.includedItems?.length,
    excluded: parsed.excludedItems?.length,
    airlineName: parsed.airlineName,
    outboundFlightNo: parsed.outboundFlightNo,
    inboundFlightNo: parsed.inboundFlightNo,
    remainingSeatsCount: parsed.remainingSeatsCount,
    seatsStatusRaw: parsed.seatsStatusRaw?.slice(0, 40),
    optionalRows: optN,
    shoppingRows: shopN,
    scheduleDays: schedule.length,
    day2: schedule.find((d) => d.day === 2),
    detailCollect: parsed.lottetourDetailCollectSummary,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
