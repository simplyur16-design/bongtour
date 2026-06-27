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
  for (const d of days) {
    const rt = String(d.routeText ?? '')
    assert.match(rt, /\s-\s/, `kyowontour day ${d.day} routeText must be a-b chain: ${rt}`)
    assert.equal(d.description?.split('\n')[0]?.trim(), rt, `kyowontour day ${d.day} description line1 = routeText`)
  }
}

console.log('verify-suppliers-schedule-route-text-chain: ok')
