/**
 * 등록 imageKeyword SSOT — canonical English proper name prompt + Vietnam apply 실검증.
 * npx tsx scripts/verify-schedule-image-keyword-canonical-prompt.ts
 */
import { applyRegisterScheduleImageKeywordsBySupplier } from '../lib/register-schedule-image-keywords-apply'
import { buildScheduleImageKeywordGeminiPrompt } from '../lib/register-schedule-image-keyword-gemini-fill'
import {
  REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK,
  REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK,
} from '../lib/register-schedule-image-keyword-prompt'
import { VIETNAM_DALAT_NHATRANG_DOMESTIC_HUB_ROWS } from '../lib/schedule-image-keyword-dual-slot-contract'

const failures: string[] = []

console.log('=== verify-schedule-image-keyword-canonical-prompt ===\n')

if (!REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK.includes('직역·의역·번역 금지')) {
  failures.push('SSOT block missing literal-translation ban')
}
if (!REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK.includes('Po Nagar Cham Towers')) {
  failures.push('SSOT block missing Po Nagar canonical example')
}
if (!REGISTER_GEMINI_SCHEDULE_IMAGE_KEYWORD_RESOLVE_BLOCK.includes('Do NOT translate Korean')) {
  failures.push('Gemini resolve block missing English instruction')
}

const geminiPrompt = buildScheduleImageKeywordGeminiPrompt(
  [
    {
      day: 4,
      routeText: '나트랑 - 포나가 참 사원 - 롱선사',
      title: '4일차',
      description: '나트랑 관광',
      imageKeyword: '',
      imageKeyword2: null,
    },
  ],
  { productDestination: '동남아', productTitle: '베트남', daysToFill: [4] },
)
if (!/resolve the standard English proper name/i.test(geminiPrompt)) {
  failures.push('Gemini fill prompt missing resolve instruction')
}

for (const supplier of ['modetour', 'ybtour', 'hanatour', 'lottetour', 'verygoodtour', 'kyowontour'] as const) {
  const out = applyRegisterScheduleImageKeywordsBySupplier(VIETNAM_DALAT_NHATRANG_DOMESTIC_HUB_ROWS, {
    supplierKey: supplier,
    productDestination: '동남아',
    productTitle: '베트남 달랏 나트랑',
  })
  for (const day of [1, 5] as const) {
    const kw = String(out.find((r) => r.day === day)?.imageKeyword ?? '').trim()
    if (kw.length > 0) {
      failures.push(`${supplier} day${day}: domestic hub leaked foreign kw "${kw}"`)
    }
  }
  const d4 = out.find((r) => r.day === 4)!
  const kw4 = String(d4.imageKeyword ?? '').trim()
  if (!/nha trang/i.test(kw4)) {
    failures.push(`${supplier} day4: expected Nha Trang area keyword, got "${kw4}"`)
  }
}

if (failures.length) {
  console.error(`FAILED: ${failures.length}\n`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('PASSED: canonical prompt SSOT + Gemini prompt + Vietnam 6-supplier apply\n')
