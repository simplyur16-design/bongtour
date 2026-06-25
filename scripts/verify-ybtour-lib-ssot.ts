/**
 * ybtour lib·등록 허브 회귀 가드 (E2E 무관).
 * npx tsx scripts/verify-ybtour-lib-ssot.ts
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

const flow = read('lib/ybtour-register-flow.ts')
const handler = read('lib/parse-and-register-ybtour-handler.ts')
const apiParse = read('lib/ybtour-register-api-parse.ts')
const registerParse = read('lib/register-parse-ybtour.ts')

const hubs = [
  'lib/parse-and-register-ybtour-handler.ts',
  'lib/ybtour-register-flow.ts',
  'lib/ybtour-register-api-parse.ts',
  'lib/register-parse-ybtour.ts',
  'lib/register-llm-schema-ybtour.ts',
  'lib/ybtour-register-detail-collect.ts',
  'lib/ybtour-register-api-detail.ts',
]
for (const h of hubs) {
  assert(fs.existsSync(path.join(root, h)), `missing hub: ${h}`)
}

assert(!fs.existsSync(path.join(root, 'lib/register-from-llm-ybtour.ts')), 'register-from-llm-ybtour must be removed')
assert(
  !fs.existsSync(path.join(root, 'lib/parse-and-register-ybtour-orchestration.ts')),
  'legacy ybtour orchestration must be removed',
)
assert(
  !fs.existsSync(path.join(root, 'lib/register-schedule-extract-ybtour.ts')),
  'register-schedule-extract-ybtour must be removed',
)

assert(flow.includes('syncProductGeoTags'), 'flow must call syncProductGeoTags')
assert(!flow.includes('missingGeminiKey'), 'ybtour register flow must not block on missing Gemini key')
assert(!flow.includes('extractHighlightFromYbtourLLM'), 'ybtour register flow must not use highlight LLM')
assert(!flow.includes('testGeminiConnection'), 'ybtour register flow must not test Gemini connection')

assert(fs.existsSync(path.join(root, 'lib/register-admin-core-ybtour.ts')), 'missing register-admin-core-ybtour.ts')
assert(fs.existsSync(path.join(root, 'docs/ops/ybtour-admin-register-stack.md')), 'missing ybtour-admin-register-stack.md')

const handlerLines = handler.split('\n').length
assert(handlerLines < 80, `handler should stay thin (got ~${handlerLines} lines)`)
assert(handler.includes('runYbtourRegisterFlow'), 'handler must use runYbtourRegisterFlow')

assert(apiParse.includes('collectYbtourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('REGRESSION-FREEZE[ybtour-register-api-parse]'), 'api-parse missing freeze marker')
assert(!registerParse.includes('parseForRegisterLlmYbtour'), 'register-parse must not call LLM overlay')
assert(registerParse.includes('parseYbtourRegisterFromApi'), 'register-parse must delegate to api-parse')

const flightParser = read('lib/flight-parser-ybtour.ts')
assert(flightParser.includes('[P2] ybtour 항공 leg SSOT'), 'P2 flight-parser boundary comment')

if (failures.length) {
  console.error('[FAIL] verify-ybtour-lib-ssot')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}
console.log('[ok] verify-ybtour-lib-ssot: api-parse flow, no LLM overlay')
