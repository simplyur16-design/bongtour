/**
 * hanatour lib 파일 인벤토리 — 줄 수·import 참조·@deprecated.
 * npx tsx scripts/audit-hanatour-lib-inventory.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const libDir = path.join(process.cwd(), 'lib')
const projectRoot = process.cwd()

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) continue
    if (ent.name.includes('hanatour') && ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) {
      out.push(ent.name)
    }
  }
  return out.sort()
}

function countImporters(baseName: string, selfFile: string): number {
  let n = 0
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git') continue
        walk(full)
        continue
      }
      if (!/\.(ts|tsx|mjs)$/.test(ent.name)) continue
      const rel = path.relative(projectRoot, full).replace(/\\/g, '/')
      if (rel === selfFile || rel.endsWith('.test.ts')) continue
      const text = fs.readFileSync(full, 'utf8')
      if (text.includes(baseName)) n++
    }
  }
  walk(projectRoot)
  return n
}

type Row = {
  file: string
  lines: number
  importers: number
  deprecated: boolean
}

const files = listTsFiles(libDir)
const rows: Row[] = files.map((file) => {
  const full = path.join(libDir, file)
  const content = fs.readFileSync(full, 'utf8')
  const base = file.replace(/\.ts$/, '')
  return {
    file,
    lines: content.split(/\n/).length,
    importers: countImporters(base, `lib/${file}`),
    deprecated: /@deprecated/i.test(content),
  }
})

const zero = rows.filter((r) => r.importers === 0)
const stubs = rows.filter((r) => r.lines < 100 && r.importers > 0)

console.log(`[hanatour-lib] files=${rows.length}`)
console.log(`  zero importers: ${zero.length}`)
console.log(`  stubs (<100 lines, used): ${stubs.length}`)

if (zero.length) {
  console.log('\n-- zero importers (삭제 후보 — 수동 확인) --')
  for (const r of zero) {
    console.log(`  ${r.file} (${r.lines} lines)${r.deprecated ? ' @deprecated' : ''}`)
  }
}

const fat = [...rows].sort((a, b) => b.lines - a.lines).slice(0, 8)
console.log('\n-- largest --')
for (const r of fat) {
  console.log(`  ${String(r.lines).padStart(5)}  ${r.file}  importers=${r.importers}`)
}

if (zero.length > 0) process.exit(1)
console.log('\n[ok] audit-hanatour-lib-inventory: no zero-importer files')
