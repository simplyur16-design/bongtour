/**
 * 롯데관광 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-lottetour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[lottetour-register-ssot-freeze]: manifest
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

console.log('=== verify-lottetour-register-ssot-freeze ===\n')

const handler = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-lottetour-handler.ts'), 'utf8')
const flow = fs.readFileSync(path.join(ROOT, 'lib/lottetour-register-flow.ts'), 'utf8')
const apiParse = fs.readFileSync(path.join(ROOT, 'lib/lottetour-register-api-parse.ts'), 'utf8')
const registerParse = fs.readFileSync(path.join(ROOT, 'lib/register-parse-lottetour.ts'), 'utf8')

assert(handler.includes('REGRESSION-FREEZE[lottetour-register-ssot-freeze]'), 'handler missing freeze marker')
assert(handler.includes('runLottetourRegisterFlow'), 'handler must use runLottetourRegisterFlow')
assert(handler.includes('parseForRegisterLottetour'), 'handler must use API parseFn')
assert(handler.includes('augmentLottetourParsedWithDetailCollect'), 'handler must wire detail-collect')
assert(handler.includes('injectLottetourApiDeparturePricesIfMissing'), 'handler must wire price inject')

assert(flow.includes('REGRESSION-FREEZE[lottetour-register-ssot-freeze]'), 'flow missing freeze marker')
assert(!flow.includes('testGeminiConnection'), 'flow must not test Gemini')
assert(!flow.includes('missingGeminiKey'), 'flow must not gate on Gemini key')
assert(flow.includes('!text && !hasParsed && !originUrl'), 'flow must allow URL-only preview')

assert(apiParse.includes('collectLottetourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('parseLottetourRegisterFromApi'), 'api-parse export required')
assert(!apiParse.includes('parseForRegisterLlmLottetour'), 'api-parse must not use LLM overlay')

assert(registerParse.includes('parseLottetourRegisterFromApi'), 'register-parse must delegate to api-parse')

assert(!fs.existsSync(path.join(ROOT, 'lib/register-from-llm-lottetour.ts')), 'LLM overlay file must be removed')
assert(
  !fs.existsSync(path.join(ROOT, 'lib/parse-and-register-lottetour-orchestration.ts')),
  'legacy orchestration must be removed',
)

console.log('[static] handler + api-parse + flow guards ok')

if (failures.length === 0) {
  console.log('\nPASSED: lottetour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
