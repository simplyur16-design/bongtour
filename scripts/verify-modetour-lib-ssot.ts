/**
 * 모두투어 lib·등록 허브 회귀 가드 (E2E 무관).
 * npx tsx scripts/verify-modetour-lib-ssot.ts
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

// 1) 삭제된 크로스 공급사 오염 파일
assert(
  !fs.existsSync(path.join(lib, 'flight-preferred-legs-modetour.ts')),
  'flight-preferred-legs-modetour.ts should be removed (use flight-preferred-legs-kr-out-in)',
)

// 2) kr-out-in 존재 + ybtour가 modetour 파일을 import하지 않음
assert(fs.existsSync(path.join(lib, 'flight-preferred-legs-kr-out-in.ts')), 'flight-preferred-legs-kr-out-in.ts missing')
const ybtourLegs = read('lib/flight-preferred-legs-ybtour.ts')
assert(!ybtourLegs.includes('flight-preferred-legs-modetour'), 'ybtour still imports removed modetour legs file')
assert(ybtourLegs.includes('flight-preferred-legs-kr-out-in'), 'ybtour should use kr-out-in legs')

// 3) handler → syncProductGeoTags (단독 country sync 금지)
const handler = read('lib/parse-and-register-modetour-handler.ts')
assert(handler.includes('syncProductGeoTags'), 'handler must call syncProductGeoTags')
assert(!handler.includes('syncProductCountryTags'), 'handler must not call syncProductCountryTags alone')

// 4) 핵심 허브 파일 존재
const hubs = [
  'lib/parse-and-register-modetour-handler.ts',
  'lib/register-parse-modetour.ts',
  'lib/register-from-llm-modetour.ts',
  'lib/register-llm-schema-modetour.ts',
  'lib/detail-body-parser-modetour.ts',
  'lib/public-consumption-modetour.ts',
  'lib/flight-modetour-parser.ts',
]
for (const h of hubs) {
  assert(fs.existsSync(path.join(root, h)), `missing hub: ${h}`)
}

// 5) 인벤토리·P3 admin 스택 문서
assert(fs.existsSync(path.join(root, 'docs/ops/modetour-lib-inventory.md')), 'missing modetour-lib-inventory.md')
assert(
  fs.existsSync(path.join(root, 'docs/ops/modetour-admin-register-stack.md')),
  'missing modetour-admin-register-stack.md',
)
assert(fs.existsSync(path.join(root, 'lib/register-admin-core-modetour.ts')), 'missing register-admin-core-modetour.ts')

// 6) handler — digest 중복 제거 (P3)
assert(
  !handler.includes('function computePreviewContentDigestForBody'),
  'handler must use computeRegisterInputDigestFromBody from digest module',
)
assert(
  !handler.includes('function parsePastedBlocksFromBody'),
  'handler must use parseRegisterPastedBlocksPayload from core/digest',
)
assert(handler.includes('computeRegisterInputDigestFromBody'), 'handler must import digest SSOT')

// 7) 등록 상품명 SSOT — 로직 복제·인라인 추출 금지
const registerLlm = read('lib/register-from-llm-modetour.ts')
assert(
  registerLlm.includes('modetour-register-product-title-ssot'),
  'register-from-llm-modetour must use modetour-register-product-title-ssot',
)
assert(
  !registerLlm.includes('extractModetourVerbatimListingTitleRawFromPasteLocal'),
  'inline modetour paste title extract forbidden in register-from-llm-modetour',
)
assert(
  fs.existsSync(path.join(root, 'lib/modetour-register-product-title-ssot.ts')),
  'missing modetour-register-product-title-ssot.ts',
)
assert(
  fs.existsSync(path.join(root, 'docs/ops/modetour-register-title-contract.md')),
  'missing modetour-register-title-contract.md',
)

if (failures.length) {
  console.error('[FAIL] verify-modetour-lib-ssot')
  for (const f of failures) console.error(`  ${f}`)
  process.exit(1)
}

console.log('[ok] verify-modetour-lib-ssot: hubs, geo sync, flight-preferred-legs rename')
