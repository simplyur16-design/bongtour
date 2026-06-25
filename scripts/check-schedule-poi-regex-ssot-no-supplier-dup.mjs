/**
 * 공급사별 지역 ROI POI 테이블 금지 — schedule-poi-regex-ssot SSOT만 허용.
 * node scripts/check-schedule-poi-regex-ssot-no-supplier-dup.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const SUPPLIER_FILES = [
  'lib/hanatour-schedule-image-keyword.ts',
  'lib/modetour-schedule-image-keyword.ts',
  'lib/ybtour-schedule-image-keyword.ts',
  'lib/verygoodtour-schedule-image-keyword.ts',
  'lib/lottetour-schedule-image-keyword.ts',
  'lib/kyowontour-schedule-image-keyword.ts',
]

const FORBIDDEN = [
  /const\s+\w*POI_RULES\s*:/,
  /const\s+\w*SPOT_RULES\s*:/,
  /const\s+CITY_RULES\s*:/,
  /const\s+\w*ROUTE_POI_OVERRIDES\s*:/,
  /const\s+TURKEY_SPOT_RULES\s*:/,
]

const failures = []

for (const rel of SUPPLIER_FILES) {
  const full = path.join(ROOT, rel)
  const src = fs.readFileSync(full, 'utf8')
  for (const re of FORBIDDEN) {
    if (re.test(src)) failures.push(`${rel}: forbidden pattern ${re}`)
  }
  if (!src.includes("from '@/lib/schedule-poi-regex-ssot'") && !src.includes('from "@/lib/schedule-poi-regex-ssot"')) {
    if (rel !== 'lib/ybtour-schedule-image-keyword.ts') {
      failures.push(`${rel}: must import schedule-poi-regex-ssot`)
    }
  }
}

const ssot = fs.readFileSync(path.join(ROOT, 'lib/schedule-poi-regex-ssot.ts'), 'utf8')
if (!ssot.includes('REGRESSION-FREEZE[schedule-poi-regex-ssot]')) {
  failures.push('schedule-poi-regex-ssot.ts missing freeze marker')
}

if (failures.length) {
  console.error('check-schedule-poi-regex-ssot-no-supplier-dup: FAILED')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('check-schedule-poi-regex-ssot-no-supplier-dup: OK')
