/**
 * 모두투어 lib·등록 허브 회귀 가드 (E2E 무관).
 * npx tsx scripts/verify-modetour-lib-ssot.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures: string[] = []

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

const flow = read('lib/modetour-register-flow.ts')
const handler = read('lib/parse-and-register-modetour-handler.ts')
const apiParse = read('lib/modetour-register-api-parse.ts')
const registerParse = read('lib/register-parse-modetour.ts')

const hubs = [
  'lib/parse-and-register-modetour-handler.ts',
  'lib/modetour-register-flow.ts',
  'lib/modetour-register-api-parse.ts',
  'lib/register-parse-modetour.ts',
  'lib/register-llm-schema-modetour.ts',
  'lib/detail-body-parser-modetour.ts',
  'lib/public-consumption-modetour.ts',
  'lib/flight-modetour-parser.ts',
]
for (const h of hubs) {
  assert(fs.existsSync(path.join(root, h)), `missing hub: ${h}`)
}

assert(!fs.existsSync(path.join(root, 'lib/register-from-llm-modetour.ts')), 'register-from-llm-modetour must be removed')
assert(!fs.existsSync(path.join(root, 'lib/modetour-itinerary-schedule-overlay.ts')), 'itinerary overlay must be removed')
assert(!fs.existsSync(path.join(root, 'lib/register-modetour-pasted-schedule.ts')), 'pasted schedule supplement must be removed')

assert(flow.includes('syncProductGeoTags'), 'flow must call syncProductGeoTags')
assert(!flow.includes('syncProductCountryTags'), 'flow must not call syncProductCountryTags alone')
assert(!flow.includes('missingGeminiKey'), 'modetour register flow must not block on missing Gemini key')
assert(!flow.includes('extractHighlightFromModetourLLM'), 'modetour register flow must not use highlight LLM')
assert(!flow.includes('testGeminiConnection'), 'modetour register flow must not test Gemini connection')
assert(!flow.includes('modetourItineraryDraftsApplyParsedScheduleOverlay'), 'overlay removed from flow')

assert(fs.existsSync(path.join(root, 'lib/register-admin-core-modetour.ts')), 'missing register-admin-core-modetour.ts')

const handlerLines = handler.split('\n').length
assert(handlerLines < 80, `handler should stay thin (got ~${handlerLines} lines)`)
assert(handler.includes('runModetourRegisterFlow'), 'handler must use runModetourRegisterFlow')

assert(apiParse.includes('collectModetourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('REGRESSION-FREEZE[modetour-register-api-parse]'), 'api-parse missing freeze marker')
assert(!registerParse.includes('parseForRegisterLlmModetour'), 'register-parse must not call LLM overlay')
assert(registerParse.includes('parseModetourRegisterFromApi'), 'register-parse must delegate to api-parse')

assert(fs.existsSync(path.join(root, 'docs/ops/modetour-admin-register-stack.md')), 'missing modetour-admin-register-stack.md')
assert(fs.existsSync(path.join(root, 'lib/modetour-register-product-title-ssot.ts')), 'missing modetour-register-product-title-ssot.ts')

if (failures.length) {
  console.error('[FAIL] verify-modetour-lib-ssot')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log('[ok] verify-modetour-lib-ssot: api-parse flow, no LLM overlay')
