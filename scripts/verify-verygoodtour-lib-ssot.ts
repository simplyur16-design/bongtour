/**
 * verygoodtour lib·등록 허브 회귀 가드 (E2E 무관).
 * npx tsx scripts/verify-verygoodtour-lib-ssot.ts
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

const handler = read('lib/parse-and-register-verygoodtour-handler.ts')
const flow = read('lib/verygoodtour-register-flow.ts')
const llm = read('lib/register-from-llm-verygoodtour.ts')

assert(fs.existsSync(path.join(root, 'lib/register-admin-core-verygoodtour.ts')), 'missing register-admin-core-verygoodtour.ts')
assert(fs.existsSync(path.join(root, 'docs/ops/verygoodtour-admin-register-stack.md')), 'missing verygoodtour-admin-register-stack.md')
assert(fs.existsSync(path.join(root, 'docs/ops/verygoodtour-parse-contract.md')), 'missing verygoodtour-parse-contract.md')

assert(handler.includes('runVerygoodtourRegisterFlow'), 'handler must delegate to flow')
assert(!handler.includes('testGeminiConnection'), 'handler must not test Gemini')
assert(flow.includes('syncProductGeoTagsForRegister'), 'flow must call syncProductGeoTagsForRegister')
assert(flow.includes('findExistingProductForRegister'), 'flow must use duplicate guard')

assert(!llm.includes('resolveDirectedFlightLinesDefault'), 'P1b: remove default flight resolver')
assert(llm.includes('requireDirectedFlightLineResolver'), 'P1b: require directed flight resolver')
assert(!llm.includes('노랑풍선(ybtour) 등록 REGISTER_PROMPT'), 'P1b: remove cross-supplier prompt ref')
assert(!llm.includes('# [달력 데이터 정밀 추출]'), 'P1b: remove calendar LLM block')

const flightParser = read('lib/flight-parser-verygoodtour.ts')
assert(flightParser.includes('[P2] verygoodtour 항공 leg SSOT'), 'P2 flight-parser boundary comment')

if (failures.length) {
  console.error('FAIL:\n' + failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log('OK: verify-verygoodtour-lib-ssot')
