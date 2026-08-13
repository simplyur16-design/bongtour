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

/** Next typecheck fails if POI_KO_TO_EN / DESTINATION_MAP repeat a key (로카곶). */
// REGRESSION-FREEZE[schedule-poi-regex-ssot]: POI_KO_TO_EN unique keys (로카곶) — manifest
function collectDuplicateObjectKeys(src, constName) {
  const startRe = new RegExp(`const\\s+${constName}\\s*[:=][^{]*\\{`)
  const m = src.match(startRe)
  if (!m) return [`${constName} not found`]
  const start = src.indexOf(m[0]) + m[0].length
  let depth = 1
  let i = start
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  const body = src.slice(start, i - 1)
  const seen = new Map()
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim()
    const qm =
      line.match(/^'([^']+)'\s*:/) ||
      line.match(/^"([^"]+)"\s*:/) ||
      line.match(/^([\p{L}\p{N}_]+)\s*:/u)
    if (!qm) continue
    const k = qm[1]
    seen.set(k, (seen.get(k) || 0) + 1)
  }
  const dups = []
  for (const [k, n] of seen) {
    if (n > 1) dups.push(`${constName} duplicate key ${JSON.stringify(k)} x${n}`)
  }
  return dups
}

const pexelsKw = fs.readFileSync(path.join(ROOT, 'lib/pexels-keyword.ts'), 'utf8')
failures.push(...collectDuplicateObjectKeys(pexelsKw, 'DESTINATION_MAP'))
failures.push(...collectDuplicateObjectKeys(pexelsKw, 'POI_KO_TO_EN'))

if (failures.length) {
  console.error('check-schedule-poi-regex-ssot-no-supplier-dup: FAILED')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('check-schedule-poi-regex-ssot-no-supplier-dup: OK')
