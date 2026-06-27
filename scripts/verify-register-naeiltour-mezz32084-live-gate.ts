/**
 * 내일투어 MEZZ32084 — 신규 등록 SSOT full parse live gate.
 * 포함/불포함·옵션·쇼핑·항공·잔여좌석·일정(routeText a-g·description)·imageKeyword 슬롯.
 *
 * REGRESSION-FREEZE[naeiltour-register-mezz32084-live-gate]: manifest
 * npx tsx scripts/verify-register-naeiltour-mezz32084-live-gate.ts
 */
import assert from 'node:assert/strict'
import { parseNaeiltourRegisterFromApi } from '@/lib/naeiltour-register-api-parse'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { NAEILTOUR_SCHEDULE_ROUTE_MAX } from '@/lib/naeiltour-register-api-schedule'

const URL =
  'https://www.naeiltour.co.kr/sub/view.asp?good_cd=MEZZ32084&sub_area_cd=#n'

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

    if (slot === 'departure' || slot === 'return') {
      if (slot === 'return' && !kw && /인천|ICN|공항/i.test(String(row.routeText ?? ''))) continue
      if (slot === 'departure' || kw) {
        assert.ok(kw.length > 0, `day${day} (${slot}) imageKeyword required`)
      }
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
}

function assertScheduleRouteAndDescription(
  schedule: { day: number; routeText?: string | null; description?: string | null }[],
): void {
  assert.ok(schedule.length >= 3, `schedule days >= 3 (got ${schedule.length})`)
  for (const row of schedule) {
    const route = String(row.routeText ?? '').trim()
    if (!route) continue
    const parts = route.split(/\s*-\s*/).filter(Boolean)
    assert.ok(parts.length >= 1, `day${row.day} routeText empty segments`)
    assert.ok(
      parts.length <= NAEILTOUR_SCHEDULE_ROUTE_MAX,
      `day${row.day} routeText > ${NAEILTOUR_SCHEDULE_ROUTE_MAX} places`,
    )

    const desc = String(row.description ?? '').trim()
    assert.ok(desc.length > 0, `day${row.day} description empty`)
    const lines = desc.split(/\n/).map((l) => l.trim()).filter(Boolean)
    assert.ok(lines[0] === route, `day${row.day} description line1 must equal routeText`)
    const vibe = lines.slice(1).join(' ')
    if (vibe) {
      assert.ok(vibe.length <= 320, `day${row.day} vibe too long`)
    }
  }
}

async function main() {
  console.log('=== verify-register-naeiltour-mezz32084-live-gate ===\n')
  const parsed = await parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: URL })

  assert.match(parsed.originCode ?? '', /MEZZ32084/i)
  assert.ok((parsed.title ?? '').length >= 4, `title required (got ${parsed.title?.slice(0, 60)})`)
  assert.ok((parsed.includedItems?.length ?? 0) >= 2, `included >= 2 (got ${parsed.includedItems?.length})`)
  assert.ok((parsed.excludedItems?.length ?? 0) >= 1, `excluded >= 1 (got ${parsed.excludedItems?.length})`)
  assert.equal(parsed.hasOptionalTour, false, 'MEZZ32084 is no-option product')
  assert.ok(parsed.hasShopping === true || (parsed.shoppingSummaryText ?? '').includes('쇼핑'), 'shopping info')
  assert.ok(parsed.minimumDepartureCount != null && parsed.minimumDepartureCount >= 10, 'min departure from page')
  assert.ok(
    registerFlightCollectLooksComplete(parsed) ||
      Boolean(parsed.outboundFlightNo && parsed.inboundFlightNo && parsed.airlineName),
    'flight structured or leg hints',
  )
  if (parsed.remainingSeatsCount != null) {
    assert.ok(parsed.remainingSeatsCount >= 0, 'remaining seats numeric')
  } else {
    assert.ok(
      (parsed.seatsStatusRaw ?? '').length > 0 || parsed.minimumDepartureCount != null,
      'seats or min departure text required',
    )
  }

  const schedule = parsed.schedule ?? []
  assertScheduleRouteAndDescription(schedule)
  assertScheduleImageKeywordSlots(schedule)

  console.log('[ok] title:', parsed.title?.slice(0, 80))
  console.log('[ok] schedule days:', schedule.length)
  console.log('[ok] day1 route:', schedule[0]?.routeText)
  console.log('[ok] day1 kw:', schedule[0]?.imageKeyword)
  console.log('\nPASSED: naeiltour MEZZ32084 live gate')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
