/**
 * 하나투어 E2E SSOT 봉인 — 금지 경로·문서·진입점 회귀.
 * npx tsx scripts/verify-hanatour-e2e-seal.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(root, rel))
}

const sealPath = 'scripts/calendar_e2e_scraper_hanatour/SEAL.json'
assert(exists(sealPath), `missing ${sealPath}`)
const seal = JSON.parse(fs.readFileSync(path.join(root, sealPath), 'utf8')) as {
  forbiddenPaths?: string[]
}

for (const p of seal.forbiddenPaths ?? []) {
  assert(!exists(p), `forbidden path exists (seal violation): ${p}`)
}

const required = [
  'scripts/calendar_e2e_scraper_hanatour/README.md',
  'scripts/calendar_e2e_scraper_hanatour/main.py',
  'scripts/calendar_e2e_scraper_hanatour/scraper.py',
  'scripts/calendar_e2e_scraper_hanatour/calendar_price_scraper.py',
  'docs/ops/hanatour-e2e-ssot.md',
]

for (const r of required) {
  assert(exists(r), `missing required SSOT file: ${r}`)
}

const mainPy = fs.readFileSync(
  path.join(root, 'scripts/calendar_e2e_scraper_hanatour/main.py'),
  'utf8'
)
assert(mainPy.includes('--batch'), 'main.py must expose --batch')
assert(mainPy.includes('run_validation_batch'), 'main.py must use run_validation_batch')

const batchFn = fs.readFileSync(
  path.join(root, 'scripts/calendar_e2e_scraper_hanatour/calendar_price_scraper.py'),
  'utf8'
)
assert(batchFn.includes('run_validation_batch'), 'calendar_price_scraper missing run_validation_batch')

const dbRunner = fs.readFileSync(path.join(root, 'scripts/run-hanatour-e2e-from-db.ts'), 'utf8')
assert(
  dbRunner.includes('scripts.calendar_e2e_scraper_hanatour.main'),
  'run-hanatour-e2e-from-db must call hanatour main --batch'
)
assert(
  !dbRunner.includes('validate_hanatour_e2e_validation_set'),
  'run-hanatour-e2e-from-db must not reference deleted validate module'
)

const scraper = fs.readFileSync(
  path.join(root, 'scripts/calendar_e2e_scraper_hanatour/scraper.py'),
  'utf8'
)
assert(scraper.includes('__hanatourPricedDayCell'), 'scraper must use priced-day helper')
assert(scraper.includes('_ENUM_DAYS_WITH_SCROLL_JS'), 'scraper must scroll calendar for ENUM')

// 루트 오염 스크립트
assert(!exists('scripts/validate_hanatour_e2e_validation_set.py'), 'remove root validate_hanatour_e2e_validation_set.py')

if (failures.length) {
  console.error('[FAIL] verify-hanatour-e2e-seal')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log('[ok] verify-hanatour-e2e-seal: SSOT package sealed, no forbidden duplicates')
