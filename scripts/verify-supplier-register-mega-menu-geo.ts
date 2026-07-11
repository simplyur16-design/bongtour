/**
 * 전 공급사 등록 confirm — 메가메뉴 대·중·소분류 geo SSOT 연결 정적 가드.
 * REGRESSION-FREEZE[supplier-register-mega-menu-geo]: manifest
 *
 * npm run verify:supplier-register-mega-menu-geo
 */
import fs from 'node:fs'
import path from 'node:path'

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

function assertExcludes(content: string, needle: string, label: string) {
  if (content.includes(needle)) fail(`${label}: must not include \`${needle}\``)
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

const REQUIRED_IN_FLOW = [
  'resolveMegaMenuGeoForRegister',
  'syncProductGeoTagsForRegister',
  'buildRegisterGeoHaystackFromSchedule',
  'registerGeoTagSyncOpts',
] as const

console.log('=== verify-supplier-register-mega-menu-geo ===\n')

const resolveGeo = read('lib/register-resolve-mega-menu-geo.ts')
const syncTags = read('lib/sync-product-geo-tags.ts')
const summary = read('lib/register-mega-menu-geo-summary.ts')

assertIncludes(resolveGeo, 'REGRESSION-FREEZE[supplier-register-mega-menu-geo]', 'register-resolve-mega-menu-geo')
assertIncludes(resolveGeo, 'resolveMegaMenuGeoForRegister', 'register-resolve-mega-menu-geo')
assertIncludes(syncTags, 'REGRESSION-FREEZE[supplier-register-mega-menu-geo]', 'sync-product-geo-tags')
assertIncludes(syncTags, 'syncProductGeoTagsForRegister', 'sync-product-geo-tags')
assertIncludes(syncTags, 'megaMenuSummaryNeedsOperatorReview', 'sync-product-geo-tags')
assertIncludes(syncTags, 'countryTagKeys', 'sync-product-geo-tags')
assertIncludes(syncTags, 'REGRESSION-FREEZE[register-mega-menu-auto-classify]', 'sync-product-geo-tags')
assertIncludes(resolveGeo, 'enrichRegisterGeoInput', 'register-resolve-mega-menu-geo')
assertIncludes(resolveGeo, 'REGRESSION-FREEZE[register-mega-menu-auto-classify]', 'register-resolve-mega-menu-geo')
assertIncludes(summary, 'inferMegaMenuSubgroupFromRegisterTags', 'register-mega-menu-geo-summary')
assertIncludes(summary, 'REGRESSION-FREEZE[register-mega-menu-auto-classify]', 'register-mega-menu-geo-summary')
assertIncludes(summary, 'megaMenuPlacementForCityKey', 'register-mega-menu-geo-summary')

const postAugment = read('lib/register-parse-post-augment.ts')
assertIncludes(postAugment, 'applyRegisterPostAugmentSchedulePipeline', 'register-parse-post-augment')
assertIncludes(postAugment, 'applyRegisterScheduleImageKeywordsBySupplier', 'register-parse-post-augment')

for (const rel of SUPPLIER_FLOWS) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) {
    fail(`${rel}: missing register flow`)
    continue
  }
  const flow = read(rel)
  const label = rel.replace('lib/', '').replace('-register-flow.ts', '')
  for (const needle of REQUIRED_IN_FLOW) {
    assertIncludes(flow, needle, `${label} register flow`)
  }
  assertIncludes(flow, 'applyRegisterPostAugmentSchedulePipeline', `${label} register flow`)
  assertExcludes(flow, 'syncProductCountryTags(', `${label} register flow`)
  const usesLegacySync =
    flow.includes('syncProductGeoTags(') && !flow.includes('syncProductGeoTagsForRegister')
  if (usesLegacySync) {
    fail(`${label} register flow: must call syncProductGeoTagsForRegister (not syncProductGeoTags alone)`)
  }
}

if (failures.length === 0) {
  console.log(`OK: ${SUPPLIER_FLOWS.length} supplier register flows wired to mega-menu geo SSOT`)
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
