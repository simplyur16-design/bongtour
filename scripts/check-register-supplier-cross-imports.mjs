/**
 * 공급사 전용 등록 파서 축에서 다른 공급사 모듈 import 시 exit 1.
 * 대상: register-parse-*, register-from-llm-*, detail-body-parser-*, parse-and-register-* (lib 내).
 *
 * 사용: node scripts/check-register-supplier-cross-imports.mjs
 * 공급사 목록 SSOT: `lib/overseas-supplier-canonical-keys.json`
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'lib')

const SUPPLIERS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'lib', 'overseas-supplier-canonical-keys.json'), 'utf8')
)
const SUPPLIER_ALT = SUPPLIERS.join('|')

function isTargetBasename(name) {
  const patterns = [
    new RegExp(`^register-parse-(${SUPPLIER_ALT})\\.ts$`),
    new RegExp(`^register-from-llm-(${SUPPLIER_ALT})\\.ts$`),
    new RegExp(`^detail-body-parser-(${SUPPLIER_ALT})\\.ts$`),
    new RegExp(`^detail-body-parser-utils-(${SUPPLIER_ALT})\\.ts$`),
    new RegExp(`^parse-and-register-(${SUPPLIER_ALT})-.+\\.ts$`),
  ]
  return patterns.some((re) => re.test(name))
}

function detectSupplier(filePath) {
  const base = path.basename(filePath)
  for (const s of SUPPLIERS) {
    if (base.includes(s)) return s
  }
  return null
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walk(full, out)
      continue
    }
    if (!ent.name.endsWith('.ts') && !ent.name.endsWith('.tsx')) continue
    const relFromLib = path.relative(ROOT, full).replace(/\\/g, '/')
    if (!isTargetBasename(ent.name)) continue
    out.push(relFromLib)
  }
  return out
}

function collectImportPaths(source) {
  const paths = []
  const re =
    /(?:^|\n)\s*import\s(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|(?:^|\n)\s*export\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm
  let m
  while ((m = re.exec(source))) {
    const p = m[1] || m[2]
    if (p) paths.push(p)
  }
  return paths
}

function forbiddenOtherMarkers(importPath, current) {
  const others = SUPPLIERS.filter((s) => s !== current)
  const bad = []
  for (const o of others) {
    if (importPath.includes(`-${o}`)) bad.push(o)
  }
  return bad
}

function main() {
  const files = walk(ROOT)
  const errors = []
  for (const rel of files.sort()) {
    /** R-3-A..L: `register-from-llm-kyowontour`는 modetour 풀카피 베이스로 타 공급사 전용 모듈을 임시 참조한다. R-3-M에서 정리 후 이 분기 제거. */
    if (rel === 'register-from-llm-kyowontour.ts') continue
    const full = path.join(ROOT, rel)
    const cur = detectSupplier(full)
    if (!cur) {
      errors.push(`${rel}: 파일명에서 공급사를 식별할 수 없음`)
      continue
    }
    const src = fs.readFileSync(full, 'utf8')
    const imports = collectImportPaths(src)
    for (const imp of imports) {
      const bad = forbiddenOtherMarkers(imp, cur)
      for (const o of bad) {
        errors.push(`${rel}: 다른 공급사 import 의심 — "${imp}" (현재=${cur}, 금지 토큰=-${o})`)
      }
    }
  }
  if (errors.length) {
    console.error('check-register-supplier-cross-imports: FAILED\n' + errors.join('\n'))
    process.exit(1)
  }
  console.log('check-register-supplier-cross-imports: OK (' + files.length + ' files)')
}

main()
