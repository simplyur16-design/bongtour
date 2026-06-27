/**
 * 교원이지 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-kyowontour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[kyowontour-register-ssot-freeze]: manifest
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

console.log('=== verify-kyowontour-register-ssot-freeze ===\n')

const handler = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-kyowontour-handler.ts'), 'utf8')
const flow = fs.readFileSync(path.join(ROOT, 'lib/kyowontour-register-flow.ts'), 'utf8')
const apiParse = fs.readFileSync(path.join(ROOT, 'lib/kyowontour-register-api-parse.ts'), 'utf8')
const registerParse = fs.readFileSync(path.join(ROOT, 'lib/register-parse-kyowontour.ts'), 'utf8')

assert(handler.includes('runKyowontourRegisterFlow'), 'handler must use runKyowontourRegisterFlow')
assert(handler.includes('parseForRegisterKyowontour'), 'handler must use API parseFn')
assert(handler.includes('augmentKyowontourParsedWithDetailCollect'), 'handler must wire detail-collect')
assert(handler.includes('injectKyowontourApiDeparturePricesIfMissing'), 'handler must wire price inject')

assert(flow.includes('REGRESSION-FREEZE[kyowontour-register-ssot-freeze]'), 'flow missing freeze marker')
assert(!flow.includes('testGeminiConnection'), 'flow must not test Gemini')
assert(!flow.includes('missingGeminiKey'), 'flow must not gate on Gemini key')
assert(flow.includes('!text && !hasParsed && !originUrl'), 'flow must allow URL-only preview')

assert(apiParse.includes('collectKyowontourRegisterFacts'), 'api-parse must use register-facts')
assert(apiParse.includes('parseKyowontourRegisterFromApi'), 'api-parse export required')
assert(apiParse.includes('augmentKyowontourParsedWithDetailCollect'), 'api-parse must run detail-collect')
assert(!apiParse.includes('parseForRegisterLlmKyowontour'), 'api-parse must not use LLM overlay')

assert(registerParse.includes('parseKyowontourRegisterFromApi'), 'register-parse must delegate to api-parse')
assert(!registerParse.includes('parseForRegisterLlmKyowontour'), 'register-parse must not call LLM')

console.log('[static] handler + api-parse + flow guards ok')

if (failures.length === 0) {
  console.log('\nPASSED: kyowontour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
