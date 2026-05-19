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

const orchestration = read('lib/parse-and-register-ybtour-orchestration.ts')
const llm = read('lib/register-from-llm-ybtour.ts')

assert(fs.existsSync(path.join(root, 'lib/register-admin-core-ybtour.ts')), 'missing register-admin-core-ybtour.ts')
assert(fs.existsSync(path.join(root, 'docs/ops/ybtour-admin-register-stack.md')), 'missing ybtour-admin-register-stack.md')
assert(fs.existsSync(path.join(root, 'docs/ops/ybtour-parse-contract.md')), 'missing ybtour-parse-contract.md')

assert(!orchestration.includes('function computePreviewContentDigestForBody'), 'orchestration digest dup')
assert(!orchestration.includes('function parsePastedBlocksFromBody'), 'orchestration pastedBlocks dup')
assert(orchestration.includes('computeRegisterInputDigestFromBody'), 'orchestration must import digest')
assert(orchestration.includes('parseRegisterPastedBlocksPayload'), 'orchestration must import pasted blocks')

assert(orchestration.includes('syncProductGeoTags'), 'orchestration must call syncProductGeoTags')
assert(!orchestration.includes('register-admin-core-hanatour'), 'ybtour must not import hanatour admin core')

assert(!llm.includes('resolveDirectedFlightLinesDefault'), 'P1b: remove default flight resolver')
assert(llm.includes('requireDirectedFlightLineResolver'), 'P1b: require directed flight resolver')
assert(llm.includes('optionalTours[]·shoppingStops[] LLM 추출 금지'), 'P1b: LLM optional/shopping ban')
assert(!llm.includes('# [달력 데이터 정밀 추출]'), 'P1b: remove calendar LLM block')

const flightParser = read('lib/flight-parser-ybtour.ts')
assert(flightParser.includes('[P2] ybtour 항공 leg SSOT'), 'P2 flight-parser boundary comment')

if (failures.length) {
  console.error('FAIL:\n' + failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
console.log('OK: verify-ybtour-lib-ssot')
