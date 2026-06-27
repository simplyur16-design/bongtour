/**
 * 참좋은여행 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-verygoodtour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[verygoodtour-register-ssot-freeze]: manifest
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

console.log('=== verify-verygoodtour-register-ssot-freeze ===\n')

const handler = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-verygoodtour-handler.ts'), 'utf8')
const flow = fs.readFileSync(path.join(ROOT, 'lib/verygoodtour-register-flow.ts'), 'utf8')
const apiParse = fs.readFileSync(path.join(ROOT, 'lib/verygoodtour-register-api-parse.ts'), 'utf8')
const registerParse = fs.readFileSync(path.join(ROOT, 'lib/register-parse-verygoodtour.ts'), 'utf8')

assert(handler.includes('runVerygoodtourRegisterFlow'), 'handler must use runVerygoodtourRegisterFlow')
assert(handler.includes('parseForRegisterVerygoodtour'), 'handler must use API parseFn')
assert(handler.includes('augmentVerygoodtourParsedWithDetailCollect'), 'handler must wire detail-collect')
assert(handler.includes('injectVerygoodtourApiDeparturePricesIfMissing'), 'handler must wire price inject')
assert(!handler.includes('testGeminiConnection'), 'handler must not test Gemini')
assert(handler.split('\n').length < 80, 'handler must stay thin (orchestration in flow)')

assert(flow.includes('REGRESSION-FREEZE[verygoodtour-register-ssot-freeze]'), 'flow missing freeze marker')
assert(flow.includes('runVerygoodtourRegisterFlow'), 'flow must export runVerygoodtourRegisterFlow')
assert(!flow.includes('testGeminiConnection'), 'flow must not test Gemini')
assert(!flow.includes('missingGeminiKey'), 'flow must not gate on Gemini key')
assert(flow.includes('!text && !hasParsed && !originUrl'), 'flow must allow URL-only preview')
assert(flow.includes('extractVerygoodTripAnchorDatesFromPasteBlob'), 'flow must use verygood trip anchors')

assert(apiParse.includes('collectVerygoodtourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('parseVerygoodtourRegisterFromApi'), 'api-parse export required')
assert(apiParse.includes('augmentVerygoodtourParsedWithDetailCollect'), 'api-parse must run detail-collect')
assert(!apiParse.includes('parseForRegisterLlmVerygoodtour'), 'api-parse must not use LLM overlay')

assert(registerParse.includes('parseVerygoodtourRegisterFromApi'), 'register-parse must delegate to api-parse')
assert(!registerParse.includes('parseForRegisterLlmVerygoodtour'), 'register-parse must not call LLM')

console.log('[static] handler + api-parse + flow guards ok')

if (failures.length === 0) {
  console.log('\nPASSED: verygoodtour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
