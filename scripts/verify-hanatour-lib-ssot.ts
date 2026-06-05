/**
 * 하나투어 lib·등록 허브 회귀 가드 (E2E 무관).
 * npx tsx scripts/verify-hanatour-lib-ssot.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const lib = path.join(root, 'lib')
const failures: string[] = []

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

const orchestration = read('lib/parse-and-register-hanatour-orchestration.ts')
const handler = read('lib/parse-and-register-hanatour-handler.ts')

// 1) 핵심 허브
const hubs = [
  'lib/parse-and-register-hanatour-handler.ts',
  'lib/parse-and-register-hanatour-orchestration.ts',
  'lib/register-parse-hanatour.ts',
  'lib/register-from-llm-hanatour.ts',
  'lib/register-llm-schema-hanatour.ts',
  'lib/detail-body-parser-hanatour.ts',
  'lib/public-consumption-hanatour.ts',
  'lib/register-flight-hanatour.ts',
]
for (const h of hubs) {
  assert(fs.existsSync(path.join(root, h)), `missing hub: ${h}`)
}

// 2) geo sync
assert(orchestration.includes('syncProductGeoTags'), 'orchestration must call syncProductGeoTags')
assert(!orchestration.includes('syncProductCountryTags'), 'orchestration must not call syncProductCountryTags alone')

// 3) P3 admin core + 문서
assert(fs.existsSync(path.join(root, 'lib/register-admin-core-hanatour.ts')), 'missing register-admin-core-hanatour.ts')
assert(
  fs.existsSync(path.join(root, 'docs/ops/hanatour-admin-register-stack.md')),
  'missing hanatour-admin-register-stack.md',
)
assert(fs.existsSync(path.join(root, 'docs/ops/hanatour-lib-inventory.md')), 'missing hanatour-lib-inventory.md')
assert(
  fs.existsSync(path.join(root, 'docs/ops/hanatour-regression-baseline.md')),
  'missing hanatour-regression-baseline.md',
)

// 4) orchestration — digest 중복 제거
assert(
  !orchestration.includes('function computePreviewContentDigestForBody'),
  'orchestration must use computeRegisterInputDigestFromBody from digest module',
)
assert(
  !orchestration.includes('function parsePastedBlocksFromBody'),
  'orchestration must use parseRegisterPastedBlocksPayload from core/digest',
)
assert(orchestration.includes('computeRegisterInputDigestFromBody'), 'orchestration must import digest SSOT')
assert(orchestration.includes('parseRegisterPastedBlocksPayload'), 'orchestration must import pasted blocks SSOT')

// 5) handler는 얇은 래퍼
const handlerLines = handler.split('\n').length
assert(handlerLines < 80, `handler should stay thin (got ~${handlerLines} lines)`)

// 6) modetour 전용 파일을 hanatour가 import하지 않음
assert(!orchestration.includes('register-admin-core-modetour'), 'hanatour orchestration must not import modetour admin core')
assert(!orchestration.includes('flight-modetour-parser'), 'hanatour orchestration must not import modetour flight parser')

// 7) P1b LLM trim
const llm = read('lib/register-from-llm-hanatour.ts')
assert(!llm.includes('resolveDirectedFlightLinesDefault'), 'P1b: remove default flight resolver')
assert(llm.includes('requireDirectedFlightLineResolver'), 'P1b: require directed flight resolver')
assert(!llm.includes('REGISTER_PROMPT_HANATOUR_COMPACT'), 'P1b: remove compact duplicate prompt')
assert(fs.existsSync(path.join(root, 'docs/ops/supplier-shopping-visit-count.md')), 'missing supplier-shopping-visit-count.md')

// 8) P2 flight stack contract + 경계 주석
assert(fs.existsSync(path.join(root, 'docs/ops/hanatour-parse-contract.md')), 'missing hanatour-parse-contract.md')
const flightParser = read('lib/flight-parser-hanatour.ts')
assert(flightParser.includes('[하나투어 항공 스택 P2]'), 'flight-parser-hanatour missing P2 header')
assert(flightParser.includes('hanatour-parse-contract.md'), 'flight-parser-hanatour should cite contract')
assert(read('lib/register-flight-hanatour.ts').includes('[하나투어 항공 스택 P2]'), 'register-flight-hanatour missing P2 header')

// 9) originCode 붙여넣기 SSOT — LLM 미지정 폴백
assert(
  fs.existsSync(path.join(root, 'lib/hanatour-origin-code-from-paste.ts')),
  'missing hanatour-origin-code-from-paste.ts',
)
const originSsot = read('lib/hanatour-origin-code-from-paste.ts')
assert(originSsot.includes('REGRESSION-FREEZE[hanatour-origin-code-from-paste]'), 'origin SSOT missing freeze marker')
assert(originSsot.includes('isUnsetRegisterOriginCode'), 'origin SSOT must treat 미지정 as unset')
assert(orchestration.includes('applyHanatourOriginCodeFromPaste'), 'orchestration must apply paste originCode fallback')
assert(read('lib/register-parse-hanatour.ts').includes('applyHanatourOriginCodeFromPaste'), 'register-parse must apply paste originCode fallback')
assert(
  !read('lib/register-parse-hanatour.ts').includes('extractHanatourOriginProductCodeFromBlob'),
  'register-parse must not inline originCode extract',
)

if (failures.length) {
  console.error('[FAIL] verify-hanatour-lib-ssot')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log('[ok] verify-hanatour-lib-ssot: hubs, geo sync, admin core P3')
