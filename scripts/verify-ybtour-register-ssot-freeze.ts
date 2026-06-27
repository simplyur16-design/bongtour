/**
 * 노랑풍선 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-ybtour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[ybtour-register-ssot-freeze]: manifest
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

console.log('=== verify-ybtour-register-ssot-freeze ===\n')

const handler = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-ybtour-handler.ts'), 'utf8')
const flow = fs.readFileSync(path.join(ROOT, 'lib/ybtour-register-flow.ts'), 'utf8')
const apiParse = fs.readFileSync(path.join(ROOT, 'lib/ybtour-register-api-parse.ts'), 'utf8')
const registerParse = fs.readFileSync(path.join(ROOT, 'lib/register-parse-ybtour.ts'), 'utf8')

assert(handler.includes('REGRESSION-FREEZE[ybtour-register-ssot-freeze]'), 'handler missing freeze marker')
assert(handler.includes('runYbtourRegisterFlow'), 'handler must use runYbtourRegisterFlow')
assert(handler.includes('parseForRegisterYbtour'), 'handler must use API parseFn')
assert(handler.includes('augmentYbtourParsedWithDetailCollect'), 'handler must wire detail-collect')
assert(handler.includes('augmentYbtourScheduleExpressionParsed'), 'handler must wire schedule expression + routeText imageKeyword')
assert(handler.includes('finalizeYbtourItineraryDayDraftsFromSchedule'), 'handler must finalize itinerary from schedule')
assert(handler.includes('injectYbtourApiDeparturePricesIfMissing'), 'handler must wire price inject')

assert(flow.includes('REGRESSION-FREEZE[ybtour-register-ssot-freeze]'), 'flow missing freeze marker')
assert(!flow.includes('testGeminiConnection'), 'flow must not test Gemini')
assert(!flow.includes('missingGeminiKey'), 'flow must not gate on Gemini key')
assert(flow.includes('!text && !hasParsed && !originUrl'), 'flow must allow URL-only preview')

assert(apiParse.includes('collectYbtourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('applyYbtourScheduleExpressionToRows'), 'api-parse must normalize routeText before imageKeyword')
assert(apiParse.includes('ensureYbtourRegisterScheduleImageKeywords'), 'api-parse must apply routeText slot imageKeyword')
assert(apiParse.includes('parseYbtourRegisterFromApi'), 'api-parse export required')
assert(!apiParse.includes('parseForRegisterLlmYbtour'), 'api-parse must not use LLM overlay')

assert(registerParse.includes('parseYbtourRegisterFromApi'), 'register-parse must delegate to api-parse')

assert(!fs.existsSync(path.join(ROOT, 'lib/register-from-llm-ybtour.ts')), 'LLM overlay file must be removed')
assert(
  !fs.existsSync(path.join(ROOT, 'lib/parse-and-register-ybtour-orchestration.ts')),
  'legacy orchestration must be removed',
)

console.log('[static] handler + api-parse + flow guards ok')

if (failures.length === 0) {
  console.log('\nPASSED: ybtour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
