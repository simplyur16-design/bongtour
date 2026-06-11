/**
 * 6공급사 imageKeyword·imageKeyword2 이중 슬롯 계약 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-schedule-image-keyword-dual-slot.ts
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyRegisterScheduleImageKeywordsBySupplier } from '../lib/register-schedule-image-keywords-apply'
import { applyRegisterScheduleImageKeywordsForPreview } from '../lib/register-schedule-image-keywords-preview'
import {
  MODETOUR_BA_NA_HILLS_REGRESSION_ROWS,
  runScheduleImageKeywordDualSlotContract,
} from '../lib/schedule-image-keyword-dual-slot-contract'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const failures: string[] = []

console.log('=== verify-schedule-image-keyword-dual-slot ===\n')
console.log('REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — 6 suppliers tourism dual slot\n')

failures.push(...runScheduleImageKeywordDualSlotContract())

console.log('[1/3] shared 6-supplier contract')

try {
  execSync('node scripts/check-schedule-image-keyword-routing-parity.mjs', {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.log('[2/3] apply SSOT routing parity (static)')
} catch {
  failures.push('routing parity script failed')
}

try {
  execSync('node --import tsx --test tests/modetour-schedule-image-keyword.test.ts', {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.log('[3/3] modetour-schedule-image-keyword node tests')
} catch {
  failures.push('modetour-schedule-image-keyword.test.ts failed')
}

const opts = {
  supplierKey: 'modetour',
  productDestination: '다낭',
  productTitle: 'parity-fixture',
}
const viaApply = applyRegisterScheduleImageKeywordsBySupplier(MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, opts)
const viaPreview = applyRegisterScheduleImageKeywordsForPreview(MODETOUR_BA_NA_HILLS_REGRESSION_ROWS, opts)
for (const row of viaApply) {
  const other = viaPreview.find((r) => r.day === row.day)
  if (!other) {
    failures.push(`apply/preview parity: day ${row.day} missing in preview`)
    continue
  }
  if (String(row.imageKeyword ?? '').trim() !== String(other.imageKeyword ?? '').trim()) {
    failures.push(`apply/preview parity: day ${row.day} imageKeyword mismatch`)
  }
  if (String(row.imageKeyword2 ?? '').trim() !== String(other.imageKeyword2 ?? '').trim()) {
    failures.push(`apply/preview parity: day ${row.day} imageKeyword2 mismatch`)
  }
}

if (failures.length === 0) {
  console.log('\nPASSED: all dual-slot contract checks')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
