/**
 * 6공급사 imageKeyword·imageKeyword2 이중 슬롯 계약 — prebuild·CI 회귀 가드.
 * npx tsx scripts/verify-schedule-image-keyword-dual-slot.ts
 */
import { runScheduleImageKeywordDualSlotContract } from '../lib/schedule-image-keyword-dual-slot-contract'

const failures = runScheduleImageKeywordDualSlotContract()

console.log('=== verify-schedule-image-keyword-dual-slot ===\n')
console.log('REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — 6 suppliers tourism dual slot\n')

if (failures.length === 0) {
  console.log('PASSED: all dual-slot contract checks')
  process.exit(0)
}

console.error(`FAILED: ${failures.length} check(s)\n`)
for (const f of failures) console.error(`  - ${f}`)
process.exit(1)
