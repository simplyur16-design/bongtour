/**
 * 등록 confirm — 메가메뉴 geo + imageKeyword 회귀 통합 가드 (DB 불필요).
 * prebuild: static·tsx·node 검사만 (vitest devDep 없음). ci: + vitest 시나리오.
 * REGRESSION-FREEZE[register-confirm-mega-menu-image-guard]: manifest
 *
 * npm run verify:register-confirm-mega-menu-image-guards
 */
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)

const ROOT = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function fail(msg: string) {
  failures.push(msg)
}

function assertIncludes(content: string, needle: string, label: string) {
  if (!content.includes(needle)) fail(`${label}: missing \`${needle}\``)
}

function run(label: string, cmd: string) {
  console.log(`\n[${label}] ${cmd}`)
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
  } catch {
    fail(`${label} failed`)
  }
}

function vitestInstalled(): boolean {
  try {
    require.resolve('vitest/config')
    return true
  } catch {
    return false
  }
}

const SUPPLIER_FLOWS = [
  'lib/hanatour-register-flow.ts',
  'lib/modetour-register-flow.ts',
  'lib/ybtour-register-flow.ts',
  'lib/lottetour-register-flow.ts',
  'lib/kyowontour-register-flow.ts',
  'lib/verygoodtour-register-flow.ts',
  'lib/naeiltour-register-flow.ts',
] as const

const REGISTER_CONFIRM_WIRING = [
  'applyRegisterPostAugmentSchedulePipeline',
  'resolveMegaMenuGeoForRegister',
  'syncProductGeoTagsForRegister',
  'buildRegisterGeoHaystackFromSchedule',
] as const

console.log('=== verify-register-confirm-mega-menu-image-guards ===\n')
console.log('REGRESSION-FREEZE[register-confirm-mega-menu-image-guard]\n')

const postAugment = read('lib/register-parse-post-augment.ts')
const syncTags = read('lib/sync-product-geo-tags.ts')
const resolveGeo = read('lib/register-resolve-mega-menu-geo.ts')
const summary = read('lib/register-mega-menu-geo-summary.ts')
const applyKw = read('lib/register-schedule-image-keywords-apply.ts')

assertIncludes(postAugment, 'REGRESSION-FREEZE[register-post-augment-schedule-ssot]', 'register-parse-post-augment')
assertIncludes(postAugment, 'applyRegisterScheduleImageKeywordsBySupplier', 'register-parse-post-augment')
assertIncludes(syncTags, 'REGRESSION-FREEZE[register-mega-menu-auto-classify]', 'sync-product-geo-tags')
assertIncludes(syncTags, 'countryTagKeys', 'sync-product-geo-tags')
assertIncludes(resolveGeo, 'enrichRegisterGeoInput', 'register-resolve-mega-menu-geo')
assertIncludes(summary, 'inferMegaMenuSubgroupFromRegisterTags', 'register-mega-menu-geo-summary')
assertIncludes(summary, 'REGRESSION-FREEZE[register-confirm-mega-menu-image-guard]', 'register-mega-menu-geo-summary')
assertIncludes(applyKw, 'REGRESSION-FREEZE[schedule-image-keyword-dual-slot]', 'register-schedule-image-keywords-apply')

for (const rel of SUPPLIER_FLOWS) {
  const flow = read(rel)
  const label = rel.replace('lib/', '').replace('-register-flow.ts', '')
  for (const needle of REGISTER_CONFIRM_WIRING) {
    assertIncludes(flow, needle, `${label} register flow`)
  }
}

if (syncTags.includes('megaMenuSummaryNeedsOperatorReview(result.megaMenuSummary)')) {
  fail('sync-product-geo-tags: megaMenuSummaryNeedsOperatorReview must receive countryTagKeys opts')
}

run('mega-menu geo SSOT', 'npm run verify:supplier-register-mega-menu-geo')
run('mega-menu city leaf alignment', 'npm run verify:mega-menu-register-alignment')
run('imageKeyword routing parity', 'node scripts/check-schedule-image-keyword-routing-parity.mjs')

if (vitestInstalled()) {
  run('vitest register confirm guard', 'npx vitest run lib/register-confirm-mega-menu-image-guard.test.ts')
  run('vitest mega menu geo summary', 'npx vitest run lib/register-mega-menu-geo-summary.test.ts')
  run('vitest post-augment SSOT', 'npx vitest run lib/register-parse-post-augment.test.ts')
} else {
  console.log('\n[skip] vitest suites — prebuild / vitest devDependency not installed (ci tier runs full guard)')
}

if (failures.length === 0) {
  console.log(`\nOK: register confirm mega-menu + imageKeyword guards (${SUPPLIER_FLOWS.length} suppliers)`)
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
