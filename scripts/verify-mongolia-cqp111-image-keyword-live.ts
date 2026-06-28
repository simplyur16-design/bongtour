/**
 * 몽골 CQP1112608017CB — live collect + 등록 미리보기와 동일 경로 imageKeyword 검증.
 * REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: manifest
 *
 * npx tsx scripts/verify-mongolia-cqp111-image-keyword-live.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import { finalizeRegisterScheduleImageKeywords } from '@/lib/schedule-image-keyword-persist'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isRegisterScheduleAirlineRouteSegment } from '@/lib/register-schedule-route-place-noise'

const PKG = 'CQP1112608017CB'
const URL = `https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=${encodeURIComponent(PKG)}`

const FORBIDDEN = /MIRAGE|TOURIST CAMP|Air Premia|에어프레미아/i

function isAirlineOrAirportKw(kw: string): boolean {
  const t = kw.trim()
  if (!t) return false
  return isRegisterScheduleAirlineRouteSegment(t) || /\bairport\b|국제공항|공항/i.test(t)
}

async function main() {
  console.log(`=== live verify ${PKG} ===\n`)

  const parsed = await augmentHanatourParsedWithDetailCollect(
    { originUrl: URL } as Parameters<typeof augmentHanatourParsedWithDetailCollect>[0],
    { originUrl: URL },
  )

  assert.ok(parsed.hanatourDetailCollectRan, 'detail collect must run')
  const rawSchedule = parsed.schedule ?? []
  assert.ok(rawSchedule.length >= 4, `schedule days >= 4 (got ${rawSchedule.length})`)

  console.log('[raw schedule routeText]')
  for (const row of rawSchedule) {
    console.log(`  day ${row.day}: ${String(row.routeText ?? '(null)').slice(0, 120)}…`)
  }
  console.log('')

  const preview = applyRegisterScheduleImageKeywordsForPreview(rawSchedule, {
    supplierKey: 'hanatour',
    productDestination: parsed.destination ?? '몽골',
    productTitle: parsed.title ?? '',
  })

  const uiRows = finalizeRegisterScheduleImageKeywords(preview, {
    productDestination: parsed.destination ?? '몽골',
  })

  console.log('[preview imageKeyword — same path as admin register UI]')
  for (const row of uiRows) {
    console.log(
      `  day ${row.day}: kw1=${JSON.stringify(row.imageKeyword ?? '')} kw2=${JSON.stringify(row.imageKeyword2 ?? '')}`,
    )
  }
  console.log('')

  const d1 = uiRows.find((r) => r.day === 1)
  const d2 = uiRows.find((r) => r.day === 2)
  const d3 = uiRows.find((r) => r.day === 3)
  const d4 = uiRows.find((r) => r.day === 4)

  // Rule: Day 1 must NOT be empty when route has tourism POIs
  assert.ok(String(d1?.imageKeyword ?? '').trim().length > 0, 'FAIL day1 kw1 empty — route has landmarks')
  assert.ok(String(d1?.imageKeyword2 ?? '').trim().length > 0, 'FAIL day1 kw2 empty — route has 2+ landmarks')
  assert.match(String(d1?.imageKeyword ?? ''), /Ariyabal|Terelj National Park/i, 'FAIL day1 kw1 landmark')
  assert.doesNotMatch(String(d1?.imageKeyword ?? ''), FORBIDDEN, 'FAIL day1 kw1 camp/airline')
  assert.doesNotMatch(String(d1?.imageKeyword2 ?? ''), FORBIDDEN, 'FAIL day1 kw2 camp/airline')

  // Rule: no airline/airport as keyword
  for (const row of uiRows) {
    for (const slot of [row.imageKeyword, row.imageKeyword2]) {
      const kw = String(slot ?? '').trim()
      if (!kw) continue
      assert.ok(!isAirlineOrAirportKw(kw), `FAIL day${row.day} airline/airport keyword: ${kw}`)
      assert.doesNotMatch(kw, FORBIDDEN, `FAIL day${row.day} forbidden: ${kw}`)
    }
  }

  // Rule: day2 landmarks
  assert.match(String(d2?.imageKeyword ?? ''), /Terelj National Park|Genghis Khan Statue/i, 'FAIL day2 kw1')
  assert.doesNotMatch(String(d2?.imageKeyword ?? ''), FORBIDDEN, 'FAIL day2 kw1 camp')

  // Rule: day3
  assert.match(String(d3?.imageKeyword ?? ''), /Zaisan Memorial/i, 'FAIL day3 kw1')
  assert.match(String(d3?.imageKeyword2 ?? ''), /Sukhbaatar Square/i, 'FAIL day3 kw2')

  // Rule: return day kw2 null
  assert.ok(
    d4?.imageKeyword2 == null || String(d4.imageKeyword2).trim() === '',
    `FAIL day4 return kw2 must be null (got ${d4?.imageKeyword2})`,
  )

  // Rule: trip-wide dedupe
  const used = new Set<string>()
  for (const row of uiRows) {
    for (const slot of [row.imageKeyword, row.imageKeyword2]) {
      const kw = String(slot ?? '').trim()
      if (!kw) continue
      const nk = normScheduleImageKeywordKey(kw)
      assert.ok(!used.has(nk), `FAIL trip duplicate keyword: ${kw} (day ${row.day})`)
      used.add(nk)
    }
  }

  console.log('PASSED: all SSOT rules for live CQP1112608017CB')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
