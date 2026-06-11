/**
 * 등록 imageKeyword 6공급사 switch — apply SSOT + preview/ui 위임 동일성.
 * node scripts/check-schedule-image-keyword-routing-parity.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const SUPPLIERS = [
  'hanatour',
  'modetour',
  'ybtour',
  'verygoodtour',
  'lottetour',
  'kyowontour',
]

const APPLY_FN = {
  hanatour: 'applyHanatourScheduleImageKeywordsToRows',
  modetour: 'applyModetourScheduleImageKeywordsToRows',
  ybtour: 'applyYbtourScheduleImageKeywordsToRows',
  verygoodtour: 'applyVerygoodScheduleImageKeywordsToRows',
  lottetour: 'applyLottetourScheduleImageKeywordsToRows',
  kyowontour: 'applyKyowontourScheduleImageKeywordsToRows',
}

const failures = []

function read(rel) {
  const full = path.join(ROOT, rel)
  if (!fs.existsSync(full)) {
    failures.push(`missing file: ${rel}`)
    return ''
  }
  return fs.readFileSync(full, 'utf8')
}

const apply = read('lib/register-schedule-image-keywords-apply.ts')
const preview = read('lib/register-schedule-image-keywords-preview.ts')
const ui = read('lib/register-schedule-image-keywords-ui.ts')

if (!apply.includes('applyRegisterScheduleImageKeywordsBySupplier')) {
  failures.push('apply.ts missing applyRegisterScheduleImageKeywordsBySupplier')
}
if (!apply.includes('REGRESSION-FREEZE[schedule-image-keyword-dual-slot]')) {
  failures.push('apply.ts missing REGRESSION-FREEZE[schedule-image-keyword-dual-slot]')
}

for (const supplier of SUPPLIERS) {
  const caseNeedle = `case '${supplier}':`
  const fn = APPLY_FN[supplier]
  if (!apply.includes(caseNeedle)) failures.push(`apply missing switch ${caseNeedle}`)
  if (fn && !apply.includes(fn)) failures.push(`apply missing ${fn} for ${supplier}`)
}

if (!preview.includes('applyRegisterScheduleImageKeywordsBySupplier')) {
  failures.push('preview must delegate to applyRegisterScheduleImageKeywordsBySupplier')
}
if (!ui.includes('applyRegisterScheduleImageKeywordsBySupplier')) {
  failures.push('ui must delegate to applyRegisterScheduleImageKeywordsBySupplier')
}
if (preview.includes("case 'hanatour':") || preview.includes("case 'modetour':")) {
  failures.push('preview must not duplicate supplier switch — use apply SSOT')
}
if (ui.includes("case 'hanatour':") || ui.includes("case 'modetour':")) {
  failures.push('ui must not duplicate supplier switch — use apply SSOT')
}

if (failures.length) {
  console.error('check-schedule-image-keyword-routing-parity: FAILED')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('check-schedule-image-keyword-routing-parity: OK (apply SSOT, preview/ui delegate)')
