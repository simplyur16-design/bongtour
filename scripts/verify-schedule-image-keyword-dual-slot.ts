/**
 * 6공급사 imageKeyword·imageKeyword2 — prebuild·CI 회귀 가드 (공급사별 node:test 포함).
 * npx tsx scripts/verify-schedule-image-keyword-dual-slot.ts
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyRegisterScheduleImageKeywordsBySupplier } from '../lib/register-schedule-image-keywords-apply'
import { applyRegisterScheduleImageKeywordsForPreview } from '../lib/register-schedule-image-keywords-preview'
import { SCHEDULE_IMAGE_KEYWORD_SUPPLIER_PREBUILD_TESTS } from '../lib/schedule-image-keyword-supplier-prebuild-tests'
import {
  MODETOUR_BA_NA_HILLS_REGRESSION_ROWS,
  runScheduleImageKeywordDualSlotContract,
} from '../lib/schedule-image-keyword-dual-slot-contract'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const failures: string[] = []

console.log('=== verify-schedule-image-keyword-dual-slot ===\n')
console.log('REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — 6 suppliers (contract + per-supplier tests)\n')

failures.push(...runScheduleImageKeywordDualSlotContract())
console.log('[contract] shared 6-supplier dual-slot contract')

try {
  execSync('node scripts/check-schedule-image-keyword-routing-parity.mjs', {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.log('[routing] apply SSOT — preview/ui delegate, no duplicate switch')
} catch {
  failures.push('routing parity script failed')
}

let step = 0
const total = SCHEDULE_IMAGE_KEYWORD_SUPPLIER_PREBUILD_TESTS.length
for (const { supplier, nodeTest } of SCHEDULE_IMAGE_KEYWORD_SUPPLIER_PREBUILD_TESTS) {
  step += 1
  console.log(`\n[${step}/${total}] ${supplier} — node:test ${nodeTest}`)
  try {
    execSync(`node --import tsx --test ${nodeTest}`, {
      cwd: ROOT,
      stdio: 'inherit',
    })
  } catch {
    failures.push(`${supplier}: ${nodeTest} failed`)
  }
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
  console.log('\nPASSED: contract + routing + 6 supplier prebuild tests')
  process.exit(0)
}

console.error(`\nFAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
