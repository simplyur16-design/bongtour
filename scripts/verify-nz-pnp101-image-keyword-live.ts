/**
 * NZ 남섬 PNP101260802KE1 — live collect + 등록 미리보기와 동일 경로 imageKeyword 검증.
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: manifest
 *
 * npx tsx scripts/verify-nz-pnp101-image-keyword-live.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import { finalizeRegisterScheduleImageKeywords } from '@/lib/schedule-image-keyword-persist'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

const PKG = 'PNP101260802KE1'
const URL = `https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=${encodeURIComponent(PKG)}&prePage=major-products`

async function main() {
  console.log(`=== live verify ${PKG} ===\n`)

  const parsed = await augmentHanatourParsedWithDetailCollect(
    { originUrl: URL } as Parameters<typeof augmentHanatourParsedWithDetailCollect>[0],
    { originUrl: URL },
  )

  assert.ok(parsed.hanatourDetailCollectRan, 'detail collect must run')
  const rawSchedule = parsed.schedule ?? []
  assert.ok(rawSchedule.length >= 7, `schedule days >= 7 (got ${rawSchedule.length})`)

  console.log('[raw schedule routeText]')
  for (const row of rawSchedule) {
    console.log(`  day ${row.day}: ${String(row.routeText ?? row.description ?? '(null)').slice(0, 140)}`)
  }
  console.log('')

  const preview = applyRegisterScheduleImageKeywordsForPreview(rawSchedule, {
    supplierKey: 'hanatour',
    productDestination: parsed.destination ?? '뉴질랜드',
    productTitle: parsed.title ?? '',
  })

  const uiRows = finalizeRegisterScheduleImageKeywords(preview, {
    productDestination: parsed.destination ?? '뉴질랜드',
  })

  console.log('[preview imageKeyword — same path as admin register UI]')
  for (const row of uiRows) {
    console.log(
      `  day ${row.day}: kw1=${JSON.stringify(row.imageKeyword ?? '')} kw2=${JSON.stringify(row.imageKeyword2 ?? '')}`,
    )
  }
  console.log('')

  const byDay = (d: number) => uiRows.find((r) => r.day === d)
  const maxDay = Math.max(...uiRows.map((r) => r.day))

  // 출발·귀국 kw2 null
  assert.ok(byDay(1)?.imageKeyword2 == null || String(byDay(1)?.imageKeyword2 ?? '').trim() === '', 'day1 kw2 null')
  assert.ok(
    byDay(maxDay)?.imageKeyword2 == null || String(byDay(maxDay)?.imageKeyword2 ?? '').trim() === '',
    `day${maxDay} kw2 null`,
  )

  // hub-only 출발·귀국 kw1 비지 않음
  assert.ok(String(byDay(1)?.imageKeyword ?? '').trim().length > 0, 'FAIL day1 kw1 empty')
  assert.ok(String(byDay(maxDay)?.imageKeyword ?? '').trim().length > 0, `FAIL day${maxDay} kw1 empty`)

  // middle days with routeText — kw1 filled
  for (const row of uiRows) {
    const day = Number(row.day)
    if (day <= 1 || day >= maxDay) continue
    const rt = String(rawSchedule.find((r) => r.day === day)?.routeText ?? '').trim()
    if (!rt) continue
    assert.ok(String(row.imageKeyword ?? '').trim().length > 0, `FAIL day${day} kw1 empty (has routeText)`)
  }

  // Day 2 Queenstown route — not empty
  assert.match(String(byDay(2)?.imageKeyword ?? ''), /Kawarau|Arrowtown|Queenstown|Nevis/i, 'FAIL day2 kw1')

  // Day 5 Christchurch — not Savage Memorial first, not bare Christchurch kw2
  const d5kw1 = String(byDay(5)?.imageKeyword ?? '')
  const d5kw2 = String(byDay(5)?.imageKeyword2 ?? '')
  if (d5kw1) {
    assert.doesNotMatch(d5kw1, /Michael Joseph Savage|Savage Memorial/i, 'FAIL day5 kw1 Auckland memorial on Christchurch day')
    assert.match(d5kw1, /Hagley|Avon|Mona Vale|Christchurch Tram/i, 'FAIL day5 kw1 Christchurch landmark')
  }
  if (d5kw2) {
    assert.ok(!isBareCityOrCountryKeyword(d5kw2), `FAIL day5 kw2 bare city: ${d5kw2}`)
  }

  // Day 8 kw2 not bare Rotorua
  const d8kw2 = String(byDay(8)?.imageKeyword2 ?? '')
  if (d8kw2) {
    assert.notEqual(d8kw2.trim(), 'Rotorua', 'FAIL day8 kw2 bare Rotorua')
  }

  // trip-wide dedupe — 출발·귀국 bare visit city soft-dup(Queenstown/Bali)만 허용
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return soft-dup visit city — manifest
  const used = new Map<string, number>()
  for (const row of uiRows) {
    const day = Number(row.day)
    for (const slot of [row.imageKeyword, row.imageKeyword2]) {
      const kw = String(slot ?? '').trim()
      if (!kw) continue
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk) continue
      if (used.has(nk)) {
        const prev = used.get(nk)!
        const touchesEdge = day <= 1 || day >= maxDay || prev <= 1 || prev >= maxDay
        const allowEdge = isBareCityOrCountryKeyword(kw) && touchesEdge
        assert.ok(allowEdge, `FAIL trip duplicate keyword: ${kw} (day ${day})`)
      } else {
        used.set(nk, day)
      }
    }
  }

  console.log(`PASSED: all SSOT rules for live ${PKG}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
