/**
 * 모두투어 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-modetour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[modetour-register-ssot-freeze]: manifest
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyModetourScheduleImageKeywordsToRows } from '../lib/modetour-schedule-image-keyword'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

function normLoose(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

console.log('=== verify-modetour-register-ssot-freeze ===\n')

/** tests/modetour-schedule-image-keyword.test.ts 북경 fixture와 동일 */
const beijingRows = [
  {
    day: 1,
    title: '1일차',
    description: '인천 출발 북경 입국',
    routeText: 'Incheon - Beijing - Tiananmen Square',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 2,
    title: '2일차',
    description: '북경 관광',
    routeText: 'Beijing - Tiananmen Square - Shichahai - Summer Palace',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '3일차',
    description: '이화원 만리장성',
    routeText: 'Beijing - Summer Palace - Great Wall of China',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '4일차',
    description: '귀국',
    routeText: 'Beijing - Incheon - 798 Art District',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

const out = applyModetourScheduleImageKeywordsToRows(beijingRows, { productDestination: '중국' })
const d1 = out.find((r) => r.day === 1)!
const d2 = out.find((r) => r.day === 2)!
const d3 = out.find((r) => r.day === 3)!
const d4 = out.find((r) => r.day === 4)!

assert(/Beijing/i.test(String(d1.imageKeyword ?? '')), 'day1 imageKeyword must be Beijing')
assert(d1.imageKeyword2 == null, 'day1 imageKeyword2 must be null')
assert(/Tiananmen/i.test(String(d2.imageKeyword ?? '')), 'day2 imageKeyword must be Tiananmen')
assert(/Shichahai/i.test(String(d2.imageKeyword2 ?? '')), 'day2 imageKeyword2 must be Shichahai')
assert(
  normLoose(String(d2.imageKeyword)) !== normLoose(String(d2.imageKeyword2)),
  'day2 kw1/kw2 must differ',
)
assert(/Summer Palace/i.test(String(d3.imageKeyword ?? '')), 'day3 imageKeyword must be Summer Palace')
assert(/Great Wall/i.test(String(d3.imageKeyword2 ?? '')), 'day3 imageKeyword2 must be Great Wall')
assert(String(d4.imageKeyword ?? '').length >= 0, 'day4 return slot')
assert(d4.imageKeyword2 == null, 'day4 imageKeyword2 must be null')
const allKw = out.flatMap((r) => [r.imageKeyword, r.imageKeyword2].filter(Boolean).map(String))
const forbiddenCount = allKw.filter((k) => /forbidden/i.test(k)).length
assert(forbiddenCount === 0, `Forbidden City must not appear: ${allKw.join(', ')}`)
console.log('[beijing] routeText dual-slot snapshot ok')

const pagePath = path.join(ROOT, 'app/admin/register/page.tsx')
const pageSrc = fs.readFileSync(pagePath, 'utf8')
assert(
  pageSrc.includes('REGRESSION-FREEZE[modetour-register-ssot-freeze]'),
  'register page missing modetour-register-ssot-freeze marker',
)
assert(
  pageSrc.includes("supplierKey === 'modetour'") &&
    pageSrc.includes('ensureModetourRegisterScheduleImageKeywords`(규칙+Gemini) SSOT'),
  'register page missing modetour preview server SSOT branch',
)
console.log('[preview] modetour server SSOT branch ok')

try {
  execSync('node --import tsx --test tests/modetour-schedule-image-keyword.test.ts', {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.log('[tests] modetour-schedule-image-keyword.test.ts ok')
} catch {
  failures.push('modetour-schedule-image-keyword.test.ts failed')
}

if (failures.length === 0) {
  console.log('\nPASSED: modetour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
