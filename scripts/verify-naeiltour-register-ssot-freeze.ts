/**
 * 내일투어 등록 SSOT 스냅샷 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-naeiltour-register-ssot-freeze.ts
 *
 * REGRESSION-FREEZE[naeiltour-register-ssot-freeze]: manifest
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

console.log('=== verify-naeiltour-register-ssot-freeze ===\n')

const handler = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-naeiltour-handler.ts'), 'utf8')
const flow = fs.readFileSync(path.join(ROOT, 'lib/naeiltour-register-flow.ts'), 'utf8')
const registerParse = fs.readFileSync(path.join(ROOT, 'lib/register-parse-naeiltour.ts'), 'utf8')
const detailCollect = fs.readFileSync(path.join(ROOT, 'lib/naeiltour-register-detail-collect.ts'), 'utf8')
const priceInject = fs.readFileSync(path.join(ROOT, 'lib/naeiltour-register-api-price-inject.ts'), 'utf8')

assert(handler.includes('REGRESSION-FREEZE[naeiltour-register-ssot-freeze]'), 'handler missing freeze marker')
assert(handler.includes('runNaeiltourRegisterFlow'), 'handler must use runNaeiltourRegisterFlow')
assert(handler.includes('parseForRegisterNaeiltour'), 'handler must use API parseFn')
assert(handler.includes('savePersistedParsedOnly: true'), 'handler must keep savePersistedParsedOnly: true')
assert(handler.includes('augmentNaeiltourParsedWithDetailCollect'), 'handler must wire detail-collect')
assert(handler.includes('injectNaeiltourApiDeparturePricesIfMissing'), 'handler must wire price inject')

assert(flow.includes('REGRESSION-FREEZE[naeiltour-register-ssot-freeze]'), 'flow missing freeze marker')
assert(!flow.includes('testGeminiConnection'), 'flow must not test Gemini')
assert(!flow.includes('missingGeminiKey'), 'flow must not gate on Gemini key')
assert(flow.includes('!text && !hasParsed && !originUrl'), 'flow must allow URL-only preview')

assert(registerParse.includes('parseNaeiltourRegisterFromApi'), 'register-parse must delegate to api-parse')
assert(registerParse.includes('REGRESSION-FREEZE[naeiltour-register-ssot-freeze]'), 'register-parse missing freeze marker')

assert(
  detailCollect.includes('REGRESSION-FREEZE[naeiltour-register-detail-collect]'),
  'detail-collect missing freeze marker',
)
assert(
  detailCollect.includes('augmentNaeiltourRegisterParsedFromApiCollect'),
  'detail-collect must delegate to api-parse augment',
)

assert(
  priceInject.includes('REGRESSION-FREEZE[naeiltour-register-api-price-inject]'),
  'price-inject missing freeze marker',
)

const apiParsePath = path.join(ROOT, 'lib/naeiltour-register-api-parse.ts')
assert(flow.includes('applyRegisterPostAugmentSchedulePipeline'), 'flow must wire airtel/post-augment schedule pipeline')
assert(flow.includes('travelScope,'), 'flow must pass travelScope to parse persist')

const scheduleAug = fs.readFileSync(path.join(ROOT, 'lib/parse-and-register-naeiltour-schedule.ts'), 'utf8')
assert(
  scheduleAug.includes('REGRESSION-FREEZE[naeiltour-register-airtel]'),
  'schedule augment missing airtel freeze marker',
)
assert(scheduleAug.includes('isRegisterAirtelListing'), 'schedule augment must branch on airtel listing')

const pastePatch = fs.readFileSync(path.join(ROOT, 'lib/naeiltour-paste-deterministic-patch.ts'), 'utf8')
assert(
  pastePatch.includes('extractNaeiltourAirtelHotelInfoJsonFromPaste'),
  'paste patch must extract airtel hotel json',
)

if (fs.existsSync(apiParsePath)) {
  const apiParse = fs.readFileSync(apiParsePath, 'utf8')
  assert(apiParse.includes('parseNaeiltourRegisterFromApi'), 'api-parse export required')
  assert(!apiParse.includes('parseForRegisterLlmNaeiltour'), 'api-parse must not use LLM overlay')
  assert(apiParse.includes('NAEILTOUR_AIRTEL_PREVIEW_NOTE'), 'api-parse must document airtel path')
  assert(apiParse.includes('travelScope'), 'api-parse must accept travelScope')
} else {
  console.log('[static] naeiltour-register-api-parse.ts not present yet — skipping api-parse guards')
}

assert(!fs.existsSync(path.join(ROOT, 'lib/register-from-llm-naeiltour.ts')), 'LLM overlay file must be removed')

console.log('[static] handler + flow + register-parse guards ok')

if (failures.length === 0) {
  console.log('\nPASSED: naeiltour register SSOT snapshot')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
