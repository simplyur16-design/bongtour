/**
 * REGRESSION-FREEZE[suppliers-schedule-route-text-chain]
 * 일정요약 routeText가 단일 지명이 아닌 `a - b - c` 체인인지 공급사별 SSOT 점검.
 * 실행: npm run verify:suppliers-schedule-route-text-chain
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustInclude(rel: string, needles: string[], label: string): void {
  const src = read(rel)
  for (const n of needles) {
    assert.ok(src.includes(n), `${label}: ${rel} must include ${n}`)
  }
}

/** 표현층 apply*ScheduleExpressionToRows — augment·api-parse·collect 경로 */
const EXPRESSION_APPLY: Array<{ supplier: string; file: string; fn: string }> = [
  { supplier: 'lottetour', file: 'lib/parse-and-register-lottetour-schedule.ts', fn: 'applyLottetourScheduleExpressionToRows' },
  { supplier: 'ybtour', file: 'lib/parse-and-register-ybtour-schedule.ts', fn: 'applyYbtourScheduleExpressionToRows' },
  { supplier: 'naeiltour', file: 'lib/naeiltour-register-api-parse.ts', fn: 'applyNaeiltourScheduleExpressionToRows' },
  { supplier: 'verygoodtour', file: 'lib/parse-and-register-verygoodtour-schedule.ts', fn: 'applyVerygoodtourScheduleExpressionToRows' },
  { supplier: 'kyowontour', file: 'lib/parse-and-register-kyowontour-schedule.ts', fn: 'applyKyowontourScheduleExpressionToRows' },
]

for (const { supplier, file, fn } of EXPRESSION_APPLY) {
  mustInclude(file, [fn], supplier)
}

mustInclude('lib/parse-and-register-hanatour-schedule.ts', ["join(' - ')"], 'hanatour')
mustInclude('lib/modetour-register-api-schedule.ts', ["places.join(' - ')"], 'modetour')
mustInclude('lib/kyowontour-register-api-schedule.ts', ['buildKyowontourScheduleRouteTextFromTabRows'], 'kyowontour collect')

import { CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE, parseKyowontourScheduleTabDetail } from '../lib/kyowontour-tour-event-tab-data'
import { scheduleTabParsedToRegisterDays } from '../lib/kyowontour-register-schedule-collect'

{
  const tab = parseKyowontourScheduleTabDetail(CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE)
  const days = scheduleTabParsedToRegisterDays(tab)
  const maxDay = days.reduce((m, d) => Math.max(m, d.day), 0)
  for (const d of days) {
    const rt = String(d.routeText ?? '')
    const isMiddle = d.day > 1 && d.day < maxDay
    if (isMiddle) {
      assert.match(rt, /\s-\s/, `kyowontour day ${d.day} routeText must be a-b chain: ${rt}`)
    } else {
      assert.ok(rt.length >= 2, `kyowontour day ${d.day} routeText must not be empty: ${rt}`)
    }
    const hasDomesticHub = /(?:^|\s-\s)(?:인천|김포|부산|ICN|GMP)(?:\s|$|-)/u.test(rt)
    if (hasDomesticHub) {
      const departureForeignChain =
        d.day === 1 &&
        /^(?:인천|김포|부산|ICN|GMP)\s*-\s*/u.test(rt) &&
        rt.split(/\s+-\s+/).filter(Boolean).length >= 2
      assert.ok(
        departureForeignChain,
        `kyowontour day ${d.day} domestic hub only on day1 departure→destination chain: ${rt}`,
      )
    }
    assert.notEqual(d.description?.trim(), rt, `kyowontour day ${d.day} description must not copy routeText`)
    assert.ok(
      (d.description?.length ?? 0) >= 20,
      `kyowontour day ${d.day} description must be vibe prose (2~3 sentences)`,
    )
  }
}

console.log('verify-suppliers-schedule-route-text-chain: ok')
