/**
 * 참좋은여행 APP0671-260628KE — 신규 등록 SSOT full parse live gate.
 * 포함/불포함·옵션·쇼핑·항공·잔여좌석·일정(routeText a-g·description)·imageKeyword 슬롯.
 *
 * REGRESSION-FREEZE[verygoodtour-register-app0671-260628-live-gate]: manifest
 * npx tsx scripts/verify-register-verygoodtour-app0671-260628-live-gate.ts
 */
import assert from 'node:assert/strict'
import { parseVerygoodtourRegisterFromApi } from '@/lib/verygoodtour-register-api-parse'
import { buildRegisterAdminPreviewCardData } from '@/lib/register-admin-preview-card-build'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { VERYGOODTOUR_SCHEDULE_ROUTE_MAX } from '@/lib/verygoodtour-register-api-schedule'

const URL =
  'https://www.verygoodtour.com/Product/PackageDetail?ProCode=APP0671-260628KE&PriceSeq=9&MenuCode=leaveLayer'

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
  schedule: { day: number; imageKeyword?: string | null; imageKeyword2?: string | null; routeText?: string | null }[],
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
    assert.ok(
      parts.length <= VERYGOODTOUR_SCHEDULE_ROUTE_MAX,
      `day${row.day} routeText > ${VERYGOODTOUR_SCHEDULE_ROUTE_MAX} places`,
    )

    const desc = String(row.description ?? '').trim()
    assert.ok(desc.length > 0, `day${row.day} description empty`)
    assert.notEqual(desc, route, `day${row.day} description must not copy routeText`)
    const sentenceCount = desc.split(/[.!?]\s+/).filter((s) => s.length > 8).length
    assert.ok(sentenceCount >= 1 && sentenceCount <= 4, `day${row.day} vibe sentence count ${sentenceCount}`)
    assert.ok(desc.length <= 320, `day${row.day} vibe too long`)
  }
}

async function main() {
  const parsed = await parseVerygoodtourRegisterFromApi('', 'verygoodtour', { originUrl: URL })

  assert.match(parsed.originCode ?? '', /APP0671-260628KE/i)
  assert.ok((parsed.title ?? '').length >= 4, `title required (got ${parsed.title?.slice(0, 60)})`)

  assert.ok((parsed.includedItems?.length ?? 0) >= 2, `included >= 2 (got ${parsed.includedItems?.length})`)
  assert.ok((parsed.excludedItems?.length ?? 0) >= 1, `excluded >= 1 (got ${parsed.excludedItems?.length})`)

  assert.ok(registerFlightCollectLooksComplete(parsed), 'flight: airline·편명·시간')
  assert.ok(parsed.outboundFlightNo?.trim(), 'outbound flight no')
  assert.ok(parsed.inboundFlightNo?.trim(), 'inbound flight no')

  const optN = countJsonRows(parsed.optionalToursStructured)
  const shopN = countJsonRows(parsed.shoppingStops)
  assert.ok(optN >= 1 || parsed.hasOptionalTour === true, `optional rows >= 1 (got ${optN})`)
  assert.ok(shopN >= 1 || (parsed.shoppingVisitCount ?? 0) >= 1, `shopping rows >= 1 (got ${shopN})`)

  assert.ok(
    (parsed.remainingSeatsCount != null && parsed.remainingSeatsCount >= 0) ||
      (parsed.currentBookedCount != null && parsed.minimumDepartureCount != null),
    'booking meta: remainingSeatsCount or 예약현황(current+minimum) from PackageDetail',
  )

  const schedule = parsed.schedule ?? []
  assert.ok(schedule.length >= 5, `schedule days >= 5 (got ${schedule.length})`)
  assertScheduleRouteAndDescription(schedule)
  assertScheduleImageKeywordSlots(schedule)

  const card = buildRegisterAdminPreviewCardData({
    parsed,
    productDraft: { title: parsed.title ?? '', duration: parsed.duration ?? '', priceFrom: 0 },
    schedule,
    originalBodyText: '',
    fieldIssues: [],
  })
  assert.ok(card.includedItems.length >= 2, 'preview included')
  assert.ok(card.excludedItems.length >= 1, 'preview excluded')

  console.log('OK verygoodtour APP0671-260628KE live gate', {
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
    detailCollect: parsed.verygoodtourDetailCollectSummary,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
