/**
 * REGRESSION-FREEZE[suppliers-schedule-route-noise-and-keyword-dedupe]: manifest
 * 전 공급사 — routeText 행정/UI noise 제거 + trip-wide imageKeyword 중복 금지 실검.
 *
 * 실행: npm run verify:suppliers-schedule-route-noise-and-keyword-dedupe
 *       npm run verify:suppliers-schedule-route-noise-and-keyword-dedupe -- --live
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { ybtourFactDaysToRegisterSchedule, applyYbtourScheduleExpressionToRows } from '@/lib/ybtour-register-api-schedule'
import { lottetourFactDaysToRegisterSchedule, applyLottetourScheduleExpressionToRows } from '@/lib/lottetour-register-api-schedule'
import { verygoodtourFactDaysToRegisterSchedule, applyVerygoodtourScheduleExpressionToRows } from '@/lib/verygoodtour-register-api-schedule'
import { kyowontourFactDaysToRegisterSchedule, buildKyowontourScheduleRouteTextFromTabRows } from '@/lib/kyowontour-register-api-schedule'
import { naeiltourFactDaysToRegisterSchedule, applyNaeiltourScheduleExpressionToRows } from '@/lib/naeiltour-register-api-schedule'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { parseModetourRegisterFromApi } from '@/lib/modetour-register-api-parse'
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { KyowontourScheduleRowParsed } from '@/lib/kyowontour-tour-event-tab-data'

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..')
const LIVE = process.argv.includes('--live')

const ROUTE_ADMIN_RE = /(?:입국|출국|출입국)(?:\s*(?:시|에|할))?[\s\S]{0,24}(?:관련\s*)?안내|관련\s*안내|한국\s*[-·]\s*일본\s*여행|여행\s*일정/u

const ADMIN_NOISE = '한국-일본 여행 입국시 관련 안내'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustInclude(rel: string, needles: string[]): void {
  const src = read(rel)
  for (const n of needles) {
    assert.ok(src.includes(n), `${rel} must include ${n}`)
  }
}

function assertRouteNoAdminNoise(routeText: string | null | undefined, label: string): void {
  const rt = String(routeText ?? '').trim()
  if (!rt) return
  assert.ok(!ROUTE_ADMIN_RE.test(rt), `${label}: routeText must not contain admin guidance: ${rt}`)
}

function assertTripUniqueKeywords(
  rows: Array<{ day: number; imageKeyword?: string | null; imageKeyword2?: string | null }>,
  label: string,
): void {
  const used = new Set<string>()
  for (const row of rows) {
    for (const slot of [row.imageKeyword, row.imageKeyword2]) {
      const kw = String(slot ?? '').trim()
      if (!kw) continue
      const nk = normScheduleImageKeywordKey(kw)
      assert.ok(!used.has(nk), `${label} day ${row.day}: duplicate imageKeyword "${kw}"`)
      used.add(nk)
    }
  }
}

const FACT_DAY_BASE: RegisterFactScheduleDay[] = [
  {
    day: 1,
    places: ['인천', '돗토리', ADMIN_NOISE, '미즈키시게루 로드'],
    hotels: ['예정 호텔'],
    meals: [],
    transportNote: null,
  },
  {
    day: 2,
    places: ['요나고', '돗토리', '돗토리 사구 모래미술관', '20세기 배 기념관(나싯코관)', '코난 박물관 (아오야마 고쇼 기념관)'],
    hotels: ['예정 호텔'],
    meals: [],
    transportNote: null,
  },
  {
    day: 3,
    places: ['마츠에', '인천', '아다치 미술관', '마쓰에성', '시오미나와테 거리'],
    hotels: [],
    meals: [],
    transportNote: null,
  },
]

type SupplierGate = {
  key: string
  dest: string
  buildSchedule: () => Array<{ day: number; routeText?: string | null; title?: string; description?: string; imageKeyword?: string }>
  expressionApply?: (rows: ReturnType<SupplierGate['buildSchedule']>) => ReturnType<SupplierGate['buildSchedule']>
}

const SUPPLIERS: SupplierGate[] = [
  {
    key: 'hanatour',
    dest: '돗토리',
    buildSchedule: () => hanatourFactDaysToRegisterSchedule(FACT_DAY_BASE),
  },
  {
    key: 'modetour',
    dest: '돗토리',
    buildSchedule: () => modetourFactDaysToRegisterSchedule(FACT_DAY_BASE, { productTitle: '돗토리 3일' }),
  },
  {
    key: 'ybtour',
    dest: '돗토리',
    buildSchedule: () => ybtourFactDaysToRegisterSchedule(FACT_DAY_BASE),
    expressionApply: (rows) => applyYbtourScheduleExpressionToRows(rows),
  },
  {
    key: 'lottetour',
    dest: '돗토리',
    buildSchedule: () => lottetourFactDaysToRegisterSchedule(FACT_DAY_BASE),
    expressionApply: (rows) => applyLottetourScheduleExpressionToRows(rows),
  },
  {
    key: 'verygoodtour',
    dest: '돗토리',
    buildSchedule: () => verygoodtourFactDaysToRegisterSchedule(FACT_DAY_BASE),
    expressionApply: (rows) => applyVerygoodtourScheduleExpressionToRows(rows),
  },
  {
    key: 'kyowontour',
    dest: '돗토리',
    buildSchedule: () => kyowontourFactDaysToRegisterSchedule(FACT_DAY_BASE),
  },
  {
    key: 'naeiltour',
    dest: '돗토리',
    buildSchedule: () => naeiltourFactDaysToRegisterSchedule(FACT_DAY_BASE),
    expressionApply: (rows) => applyNaeiltourScheduleExpressionToRows(rows),
  },
]

async function main(): Promise<void> {
console.log('=== verify-suppliers-schedule-route-noise-and-keyword-dedupe ===\n')

/** SSOT wiring — 공통 noise + apply 진입 sanitize */
mustInclude('lib/register-schedule-route-place-noise.ts', ['isRegisterScheduleRoutePlaceNoise', 'sanitizeRegisterScheduleRouteText'])
mustInclude('lib/register-schedule-image-keywords-apply.ts', [
  'sanitizeRegisterScheduleRouteText',
  'enforceRegisterScheduleTripUniqueImageKeywords',
])
for (const rel of [
  'lib/hanatour-register-api-detail.ts',
  'lib/modetour-register-api-schedule.ts',
  'lib/ybtour-register-api-schedule.ts',
  'lib/lottetour-register-api-schedule.ts',
  'lib/verygoodtour-register-api-schedule.ts',
  'lib/kyowontour-register-api-schedule.ts',
  'lib/naeiltour-register-api-schedule.ts',
]) {
  mustInclude(rel, ['isRegisterScheduleRoutePlaceNoise'])
}

for (const s of SUPPLIERS) {
  const built = s.buildSchedule()
  assert.ok(built.length >= 3, `${s.key}: schedule fixture`)
  for (const row of built) {
    assertRouteNoAdminNoise(row.routeText, `${s.key} factDays day ${row.day}`)
  }

  if (s.expressionApply) {
    const dirty = s.expressionApply([
      {
        day: 1,
        title: 't',
        description: 'd',
        routeText: `인천 - 돗토리 - ${ADMIN_NOISE} - 미즈키시게루 로드`,
        imageKeyword: '',
      },
    ])
    assertRouteNoAdminNoise(dirty[0]?.routeText, `${s.key} expressionApply`)
  }

  const withKeywords = applyRegisterScheduleImageKeywordsBySupplier(
    built.map((row) => ({
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      imageKeyword: '',
      imageKeyword2: null,
    })),
    { supplierKey: s.key, productDestination: s.dest, productTitle: `${s.key}-fixture` },
  )
  for (const row of withKeywords) {
    assertRouteNoAdminNoise(row.routeText, `${s.key} apply day ${row.day}`)
  }
  assertTripUniqueKeywords(withKeywords, s.key)
  const last = withKeywords[withKeywords.length - 1]
  assert.ok(
    String(last?.imageKeyword ?? '').trim().length > 0,
    `${s.key}: last day imageKeyword must not be empty`,
  )
  console.log(`[ok] ${s.key} — routeText noise + trip keyword dedupe`)
}

{
  const kyowontourTabRows: KyowontourScheduleRowParsed[] = [
    { step: 1, type: '이동', nameKo: '인천', tmContent: '' },
    { step: 2, type: '관광', nameKo: '돗토리', tmContent: '' },
    { step: 3, type: '관광', nameKo: ADMIN_NOISE, tmContent: '' },
    { step: 4, type: '관광', nameKo: '미즈키시게루 로드', tmContent: '' },
  ]
  const rt = buildKyowontourScheduleRouteTextFromTabRows(kyowontourTabRows)
  assertRouteNoAdminNoise(rt, 'kyowontour tab routeText')
  console.log('[ok] kyowontour tab routeText')
}

if (LIVE) {
  await runLiveModetourGate()
} else {
  console.log('\n(skip live — pass --live for modetour 103488777 API gate)')
}

  console.log('\nverify-suppliers-schedule-route-noise-and-keyword-dedupe: ok')
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})

async function runLiveModetourGate(): Promise<void> {
  console.log('\n--- live modetour 103488777 (돗토리) ---')
  const url = 'https://www.modetour.com/package/103488777'
  const skeleton = await parseModetourRegisterFromApi('', 'modetour', { originUrl: url })
  const parsed = await augmentModetourParsedWithDetailCollect(skeleton, { originUrl: url })
  const schedule = parsed.schedule ?? []
  assert.ok(schedule.length >= 3, `modetour live schedule days ${schedule.length}`)
  for (const row of schedule) {
    assertRouteNoAdminNoise(row.routeText, `modetour live day ${row.day}`)
  }
  assertTripUniqueKeywords(schedule, 'modetour live 103488777')
  console.log('[ok] modetour live 103488777')
}
