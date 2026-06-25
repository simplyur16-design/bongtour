/**
 * 하나투어 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-hanatour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[hanatour-register-ssot-freeze]: manifest
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const failures: string[] = []

function fail(msg: string) {
  failures.push(msg)
}

console.log('=== verify-hanatour-register-ssot-freeze ===\n')

const handler = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-hanatour-handler.ts'), 'utf8')
const flow = fs.readFileSync(path.join(ROOT, 'lib/hanatour-register-flow.ts'), 'utf8')
const apiParse = fs.readFileSync(path.join(ROOT, 'lib/hanatour-register-api-parse.ts'), 'utf8')
const registerParse = fs.readFileSync(path.join(ROOT, 'lib/register-parse-hanatour.ts'), 'utf8')

if (!handler.includes('REGRESSION-FREEZE[hanatour-register-ssot-freeze]')) {
  fail('handler missing hanatour-register-ssot-freeze marker')
}
if (!handler.includes('runHanatourRegisterFlow')) fail('handler must use runHanatourRegisterFlow')
if (!handler.includes('recoverEmptyScheduleWithFullParse: false')) {
  fail('handler must disable LLM schedule recovery')
}
if (!handler.includes('parseForRegisterHanatour')) fail('handler must use API parseFn')

if (flow.includes('testGeminiConnection') || flow.includes('missingGeminiKey')) {
  fail('flow must not gate on Gemini')
}
if (flow.includes('parseForRegisterLlmHanatour')) fail('flow must not use LLM parse')

if (!apiParse.includes('REGRESSION-FREEZE[hanatour-register-api-parse]')) {
  fail('api-parse missing freeze marker')
}
if (!apiParse.includes('collectHanatourRegisterFacts')) fail('api-parse must use register-facts')
try {
  assert.ok(!apiParse.includes('parseForRegisterLlmHanatour'), 'api-parse must not use LLM overlay')
} catch (e) {
  fail(String(e))
}

if (!registerParse.includes('parseHanatourRegisterFromApi')) {
  fail('register-parse must delegate to api-parse')
}

if (fs.existsSync(path.join(ROOT, 'lib/register-from-llm-hanatour.ts'))) {
  fail('register-from-llm-hanatour must be removed')
}
if (fs.existsSync(path.join(ROOT, 'lib/parse-and-register-hanatour-orchestration.ts'))) {
  fail('legacy hanatour orchestration must be removed')
}

console.log('[static] handler + api-parse + flow guards ok')

if (failures.length === 0) {
  console.log('\nPASSED: hanatour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
