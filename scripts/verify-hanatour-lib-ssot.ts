/**
 * 하나투어 lib·등록 허브 회귀 가드 (E2E 무관).
 * npx tsx scripts/verify-hanatour-lib-ssot.ts
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

const flow = read('lib/hanatour-register-flow.ts')
const handler = read('lib/parse-and-register-hanatour-handler.ts')
const apiParse = read('lib/hanatour-register-api-parse.ts')
const registerParse = read('lib/register-parse-hanatour.ts')

const hubs = [
  'lib/parse-and-register-hanatour-handler.ts',
  'lib/hanatour-register-flow.ts',
  'lib/hanatour-register-api-parse.ts',
  'lib/register-parse-hanatour.ts',
  'lib/register-llm-schema-hanatour.ts',
  'lib/detail-body-parser-hanatour.ts',
  'lib/public-consumption-hanatour.ts',
  'lib/register-flight-hanatour.ts',
]
for (const h of hubs) {
  assert(fs.existsSync(path.join(root, h)), `missing hub: ${h}`)
}

assert(!fs.existsSync(path.join(root, 'lib/register-from-llm-hanatour.ts')), 'register-from-llm-hanatour must be removed')
assert(!fs.existsSync(path.join(root, 'lib/parse-and-register-hanatour-orchestration.ts')), 'legacy orchestration must be removed')

assert(flow.includes('syncProductGeoTags'), 'flow must call syncProductGeoTags')
assert(!flow.includes('syncProductCountryTags'), 'flow must not call syncProductCountryTags alone')
assert(!flow.includes('missingGeminiKey'), 'hanatour register flow must not block on missing Gemini key')
assert(!flow.includes('extractHighlightFromHanatourLLM'), 'hanatour register flow must not use highlight LLM')

assert(fs.existsSync(path.join(root, 'lib/register-admin-core-hanatour.ts')), 'missing register-admin-core-hanatour.ts')

assert(!flow.includes('function computePreviewContentDigestForBody'), 'flow must use computeRegisterInputDigestFromBody')
assert(!flow.includes('function parsePastedBlocksFromBody'), 'flow must use parseRegisterPastedBlocksPayload')
assert(flow.includes('computeRegisterInputDigestFromBody'), 'flow must import digest SSOT')
assert(flow.includes('parseRegisterPastedBlocksPayload'), 'flow must import pasted blocks SSOT')

const handlerLines = handler.split('\n').length
assert(handlerLines < 80, `handler should stay thin (got ~${handlerLines} lines)`)
assert(handler.includes('runHanatourRegisterFlow'), 'handler must use runHanatourRegisterFlow')
assert(handler.includes('recoverEmptyScheduleWithFullParse: false'), 'handler must not LLM-recover empty schedule')

assert(!flow.includes('register-admin-core-modetour'), 'hanatour flow must not import modetour admin core')
assert(!flow.includes('flight-modetour-parser'), 'hanatour flow must not import modetour flight parser')

assert(apiParse.includes('collectHanatourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('REGRESSION-FREEZE[hanatour-register-api-parse]'), 'api-parse missing freeze marker')
assert(!registerParse.includes('parseForRegisterLlmHanatour'), 'register-parse must not call LLM overlay')
assert(registerParse.includes('parseHanatourRegisterFromApi'), 'register-parse must delegate to api-parse')

assert(fs.existsSync(path.join(root, 'lib/hanatour-origin-code-from-paste.ts')), 'missing hanatour-origin-code-from-paste.ts')
const originSsot = read('lib/hanatour-origin-code-from-paste.ts')
assert(originSsot.includes('REGRESSION-FREEZE[hanatour-origin-code-from-paste]'), 'origin SSOT missing freeze marker')
assert(flow.includes('applyHanatourOriginCodeFromPaste'), 'flow must apply paste originCode fallback')
assert(registerParse.includes('parseHanatourRegisterFromApi'), 'register-parse uses api path')

assert(fs.existsSync(path.join(root, 'docs/ops/hanatour-parse-contract.md')), 'missing hanatour-parse-contract.md')
const flightParser = read('lib/flight-parser-hanatour.ts')
assert(flightParser.includes('[하나투어 항공 스택 P2]'), 'flight-parser-hanatour missing P2 header')

if (failures.length) {
  console.error('[FAIL] verify-hanatour-lib-ssot')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log('[ok] verify-hanatour-lib-ssot: api-parse flow, no LLM overlay')
