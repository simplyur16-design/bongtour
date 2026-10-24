/**
 * Phase A gate: scan a script for Prisma write patterns before running.
 * Allows only: $executeRawUnsafe('SET TRANSACTION READ ONLY')
 * Usage: npx tsx scripts/audit/check-script-writes.ts <file...>
 */
import { readFileSync } from 'fs'

const WRITE_METHOD_RE =
  /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g
const EXECUTE_RE = /\$executeRaw(?:Unsafe)?\s*\(\s*([`'"])([\s\S]*?)\1\s*\)/g

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: check-script-writes.ts <file...>')
  process.exit(2)
}

let bad = false
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const methodHits = [...src.matchAll(WRITE_METHOD_RE)].map((m) => m[0])
  const execHits: string[] = []
  for (const m of src.matchAll(EXECUTE_RE)) {
    const sql = (m[2] ?? '').replace(/\s+/g, ' ').trim()
    if (/^SET TRANSACTION READ ONLY$/i.test(sql)) continue
    execHits.push(m[0].slice(0, 80))
  }
  // bare $executeRaw without string literal (template/dynamic) — treat as risk
  if (/\$executeRaw(?:Unsafe)?\s*\(\s*(?!['"`])/.test(src)) {
    execHits.push('$executeRaw*(dynamic)')
  }
  if (methodHits.length || execHits.length) {
    bad = true
    console.log(`WRITE_RISK ${f}`)
    for (const h of [...new Set([...methodHits, ...execHits])]) console.log(`  ${h}`)
  } else {
    console.log(`CLEAN ${f}`)
  }
}
process.exit(bad ? 1 : 0)
