/**
 * 모두투어 등록 상품명 SSOT 회귀 가드 — 빌드·CI에서 실행.
 * npx tsx scripts/verify-modetour-register-title-ssot.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  isModetourDepartureWindowOnlyTitleText,
  isModetourUnacceptableRegisterListingTitle,
} from '../lib/modetour-departures'
import { extractModetourVerbatimListingTitleRawFromPaste } from '../lib/modetour-listing-title-from-paste'
import {
  MODETOUR_REGISTER_TITLE_SSOT_VERSION,
  modetourRegisterTitleBlocksConfirmSave,
  normalizeModetourRegisterTitleMinimal,
  resolveModetourRegisterProductTitle,
  resolveModetourRegisterProductTitleForConfirm,
} from '../lib/modetour-register-product-title-ssot'

const root = process.cwd()
const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg)
}

const GOOD =
  '[다낭] #바나힐 #호이안 #미케비치 #전신마사지 60분 #노쇼핑 #노옵션 3박 4일'
const BAD_WINDOW = '2026.12.12~2026.12.14 2박 3일'
const BAD_HOTEL_GRADE = '일급호텔 3박 5일'
const BAD_JUNTEUK_GRADE = '준특급 3박 5일'

// --- 런타임 계약 ---
assert(isModetourDepartureWindowOnlyTitleText(BAD_WINDOW), 'departure window detector')
assert(isModetourUnacceptableRegisterListingTitle(BAD_WINDOW), 'unacceptable register title')
assert(isModetourUnacceptableRegisterListingTitle(BAD_HOTEL_GRADE), 'hotel grade duration not title')
assert(isModetourUnacceptableRegisterListingTitle(BAD_JUNTEUK_GRADE), 'junteuk grade duration not title')
assert(!isModetourUnacceptableRegisterListingTitle(GOOD), 'good title acceptable')

const paste = `${BAD_WINDOW}\n${GOOD}\n여행 일정`
assert(extractModetourVerbatimListingTitleRawFromPaste(paste) === GOOD, 'paste picks hash title not window')

const resolved = resolveModetourRegisterProductTitle({ pasteBlob: paste, llmTitleRaw: BAD_WINDOW })
assert(
  resolved.title === normalizeModetourRegisterTitleMinimal(GOOD),
  'resolver prefers good paste over bad llm'
)
assert(!resolved.unacceptable, 'resolved title acceptable')

const badOnly = resolveModetourRegisterProductTitle({
  pasteBlob: `${BAD_WINDOW}\n3박 4일\n이스타항공`,
  llmTitleRaw: BAD_WINDOW,
})
assert(badOnly.unacceptable, 'bad-only paste+llm flagged unacceptable')

const badHotelOnly = resolveModetourRegisterProductTitle({
  pasteBlob: `${BAD_HOTEL_GRADE}\n이스타항공`,
  llmTitleRaw: BAD_HOTEL_GRADE,
})
assert(badHotelOnly.unacceptable, 'hotel grade duration paste+llm flagged unacceptable')

const confirmFixed = resolveModetourRegisterProductTitleForConfirm({
  parsedTitle: BAD_WINDOW,
  baselineTrace: { pickedSource: 'h1.product_tit', raw: GOOD, cleaned: GOOD },
})
assert(confirmFixed.title === GOOD, 'confirm uses baseline over bad parsed')
assert(!confirmFixed.unacceptable, 'confirm resolution acceptable')

assert(
  modetourRegisterTitleBlocksConfirmSave({
    prismaTitle: BAD_WINDOW,
    prismaOriginalTitle: BAD_WINDOW,
    baselineTrace: null,
  }),
  'blocks save when both titles bad and no baseline'
)
assert(
  !modetourRegisterTitleBlocksConfirmSave({
    prismaTitle: BAD_WINDOW,
    prismaOriginalTitle: BAD_WINDOW,
    baselineTrace: { pickedSource: 'h1', raw: GOOD, cleaned: GOOD },
  }),
  'does not block when baseline ok'
)

assert(MODETOUR_REGISTER_TITLE_SSOT_VERSION.length > 3, 'ssot version present')

// --- 정적 회귀 가드 (로직 복제 금지) ---
const apiParse = fs.readFileSync(path.join(root, 'lib/modetour-register-api-parse.ts'), 'utf8')
assert(
  apiParse.includes('modetour-register-product-title-ssot'),
  'modetour-register-api-parse must import title SSOT'
)
assert(
  !apiParse.includes('function extractModetourVerbatimListingTitleRawFromPaste'),
  'inline paste title extract forbidden in modetour-register-api-parse'
)

const flow = fs.readFileSync(path.join(root, 'lib/modetour-register-flow.ts'), 'utf8')
assert(flow.includes('modetourRegisterTitleBlocksConfirmSave'), 'flow must call confirm title save gate')

if (failures.length) {
  console.error('[FAIL] verify-modetour-register-title-ssot')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('[ok] verify-modetour-register-title-ssot', MODETOUR_REGISTER_TITLE_SSOT_VERSION)
