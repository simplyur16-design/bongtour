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
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
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
mustInclude('lib/register-parse-post-augment.ts', [
  'REGRESSION-FREEZE[register-post-augment-schedule-ssot]',
  'applyRegisterScheduleImageKeywordsBySupplier',
  'mergePostAugmentScheduleImageKeywords',
])
const postAugmentSrc = read('lib/register-parse-post-augment.ts')
for (const bypass of [
  'applyModetourScheduleImageKeywordsToRows',
  'applyHanatourScheduleImageKeywordsToRows',
  'applyLottetourScheduleImageKeywordsToRows',
  'applyKyowontourScheduleImageKeywordsToRows',
  'applyVerygoodScheduleImageKeywordsToRows',
  'applyNaeiltourScheduleImageKeywordsToRows',
  'applyYbtourScheduleImageKeywordsToRows',
]) {
  assert.ok(!postAugmentSrc.includes(bypass), `post-augment must not bypass SSOT via ${bypass}`)
}
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

{
  const built = modetourFactDaysToRegisterSchedule(FACT_DAY_BASE, { productTitle: '돗토리 3일' })
  const before = built.map((row) => ({
    ...row,
    imageKeyword: row.day === 3 ? 'Shiomi Nawate Samurai Street' : '',
    imageKeyword2: null,
  }))
  const postAugmented = await applyRegisterPostAugmentSchedulePipeline(
    {
      schedule: before,
      primaryDestination: '돗토리',
      destination: '돗토리',
      title: '돗토리 3일',
    },
    { forcedBrandKey: 'modetour', travelScope: 'package', mode: 'preview' },
  )
  const schedule = postAugmented.schedule ?? []
  for (const row of schedule) {
    assertRouteNoAdminNoise(row.routeText, `modetour post-augment day ${row.day}`)
  }
  assertTripUniqueKeywords(schedule, 'modetour post-augment')
  const last = schedule[schedule.length - 1]
  assert.ok(
    String(last?.imageKeyword ?? '').trim().length > 0,
    'modetour post-augment: last day imageKeyword must not be empty',
  )
  console.log('[ok] modetour post-augment SSOT pipeline')
}

{
  const BALI_SCHEDULE = [
    { day: 1, title: '-', description: 'x', routeText: '발리 주요 관광지 지도 - 발리지도', imageKeyword: '', imageKeyword2: null },
    { day: 2, title: '-', description: 'x', routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당', imageKeyword: '', imageKeyword2: null },
    { day: 3, title: '-', description: 'x', routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당', imageKeyword: '', imageKeyword2: null },
    { day: 4, title: '-', description: 'x', routeText: '전일 자유시간 - 발리에서 즐기는 여유로운 하루 - 비치 클럽 크루즈 - 발리 - 빠당빠당', imageKeyword: '', imageKeyword2: null },
    { day: 5, title: '-', description: 'x', routeText: '남부투어 - 가루다 공원 - 울루와뚜 절벽사원 - 멜라스티 비치 음료 - 발리 - 발리 해변', imageKeyword: '', imageKeyword2: null },
    { day: 6, title: '-', description: 'x', routeText: '발리', imageKeyword: '', imageKeyword2: null },
  ]
  for (const key of ['hanatour', 'modetour'] as const) {
    const out = applyRegisterScheduleImageKeywordsBySupplier(BALI_SCHEDULE, {
      supplierKey: key,
      productDestination: '발리',
      productTitle: '발리 6일',
    })
    const day5 = out.find((r) => r.day === 5)
    const day6 = out.find((r) => r.day === 6)
    assert.ok(String(day5?.imageKeyword ?? '').trim().length > 0, `${key} bali day5 imageKeyword`)
    assert.ok(String(day6?.imageKeyword ?? '').trim().length > 0, `${key} bali day6 imageKeyword`)
    assertTripUniqueKeywords(out, `${key} bali 6-day`)
  }
  console.log('[ok] bali 6-day southern tour + return keyword gate')
}

{
  const US_EAST = [
    { day: 1, routeText: '에어프레미아 항공 - 에어프리미아', imageKeyword: '', imageKeyword2: null },
    { day: 3, routeText: '워싱턴 D.C. - 링컨 기념관 - 스미소니언 박물관 - 국회의사당', imageKeyword: '', imageKeyword2: null },
    { day: 4, routeText: '캐나다 나이아가라폭포 - 테이블 락 - 나이아가라 월풀', imageKeyword: '', imageKeyword2: null },
    { day: 6, routeText: '하버드 대학교 - MIT - 보스턴', imageKeyword: '', imageKeyword2: null },
    { day: 8, routeText: '센트럴 파크 - 록펠러 센터 전망대 - 9.11 메모리얼 - 황소 동상', imageKeyword: '', imageKeyword2: null },
    { day: 10, routeText: '인천', imageKeyword: '', imageKeyword2: null },
  ]
  const out = applyRegisterScheduleImageKeywordsBySupplier(US_EAST, {
    supplierKey: 'hanatour',
    productDestination: '미국',
    productTitle: '미동부',
  })
  const d1 = out.find((r) => r.day === 1)
  const d3 = out.find((r) => r.day === 3)
  const d4 = out.find((r) => r.day === 4)
  const d6 = out.find((r) => r.day === 6)
  const d8 = out.find((r) => r.day === 8)
  const d10 = out.find((r) => r.day === 10)
  assert.ok(!String(d1?.imageKeyword ?? '').trim(), 'day1 airline-only must stay empty')
  assert.ok(String(d3?.imageKeyword ?? '').match(/Lincoln Memorial/i), 'day3 own route landmark')
  assert.ok(String(d4?.imageKeyword ?? '').match(/Niagara/i), 'day4 niagara')
  assert.ok(String(d6?.imageKeyword ?? '').match(/Harvard|MIT|Boston/i), 'day6 boston route')
  assert.ok(String(d8?.imageKeyword ?? '').match(/Central Park|Rockefeller|9\/11|Charging Bull/i), 'day8 nyc route')
  assert.ok(!String(d10?.imageKeyword ?? '').trim(), 'day10 domestic return empty')
  assert.ok(!String(d6?.imageKeyword ?? '').match(/Niagara|Washington/i), 'day6 must not bleed niagara/dc')
  console.log('[ok] US east day-owned imageKeyword gate')
}

{
  const MONGOLIA = [
    {
      day: 1,
      routeText:
        '몽골 FAQ - 시내를 떠나기 전 필수 코스! 쇼핑 타임 - 현지 대형마트 - 아리iya발 사원 - 테렐지 국립공원 명물 - 거북 바위 (Turtle Rock) - MIRAGE TOURIST CAMP',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 2,
      routeText:
        '몽골 대초원 <테렐지 국립공원> - MIRAGE TOURIST CAMP - 칭기즈칸 청동 기마상 - 기마상 전망대 및 박물관',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 3,
      routeText: '울란바토르 시내관광 - 자이승승전탑 - 수흐바타르 광장',
      imageKeyword: '',
      imageKeyword2: null,
    },
    { day: 4, title: '울란바토르', routeText: null, imageKeyword: '', imageKeyword2: null },
  ]
  const out = applyRegisterScheduleImageKeywordsBySupplier(MONGOLIA, {
    supplierKey: 'hanatour',
    productDestination: '몽골',
    productTitle: '몽골/테렐지 4일',
  })
  const d1 = out.find((r) => r.day === 1)
  const d2 = out.find((r) => r.day === 2)
  const d3 = out.find((r) => r.day === 3)
  assert.ok(String(d1?.imageKeyword ?? '').match(/Ariyabal|Terelj National Park/i), 'mongolia day1 landmark')
  assert.ok(!String(d1?.imageKeyword ?? '').match(/MIRAGE|TOURIST CAMP/i), 'mongolia day1 no camp')
  assert.ok(String(d2?.imageKeyword ?? '').match(/Terelj National Park|Genghis Khan Statue/i), 'mongolia day2 landmark')
  assert.ok(!String(d2?.imageKeyword ?? '').match(/MIRAGE|TOURIST CAMP/i), 'mongolia day2 no camp')
  assert.ok(String(d3?.imageKeyword ?? '').match(/Zaisan Memorial/i), 'mongolia day3 zaisan')
  assert.ok(String(d3?.imageKeyword2 ?? '').match(/Sukhbaatar Square/i), 'mongolia day3 sukhbaatar kw2')
  assertTripUniqueKeywords(out, 'mongolia terelj 4-day')
  console.log('[ok] Mongolia Terelj CQP111-like imageKeyword gate')
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
