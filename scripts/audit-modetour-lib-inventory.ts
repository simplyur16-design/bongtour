/**
 * modetour lib 파일 인벤토리 — 줄 수·import 참조·@deprecated.
 * npx tsx scripts/audit-modetour-lib-inventory.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const libDir = path.join(process.cwd(), 'lib')
const projectRoot = process.cwd()

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) continue
    if (ent.name.includes('modetour') && ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) {
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
      if (!/\.(ts|tsx)$/.test(ent.name)) continue
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
  pattern: string
}

function namingPattern(file: string): string {
  if (file.startsWith('modetour-')) return 'modetour-prefix'
  if (file.startsWith('register-modetour-')) return 'register-modetour'
  if (file.endsWith('-modetour.ts')) return 'suffix-modetour'
  return 'other'
}

const files = listTsFiles(libDir)
const rows: Row[] = files.map((file) => {
  const full = path.join(libDir, file)
  const content = fs.readFileSync(full, 'utf8')
  const base = file.replace(/\.ts$/, '')
  const relSelf = `lib/${file}`
  return {
    file,
    lines: content.split(/\n/).length,
    importers: countImporters(base, relSelf),
    deprecated: /@deprecated/i.test(content),
    pattern: namingPattern(file),
  }
})

const patterns = rows.reduce(
  (acc, r) => {
    acc[r.pattern] = (acc[r.pattern] ?? 0) + 1
    return acc
  },
  {} as Record<string, number>,
)

console.log('=== modetour lib inventory ===')
console.log(`total: ${rows.length}`)
console.log('patterns:', patterns)
console.log(`stubs (<100 lines): ${rows.filter((r) => r.lines < 100).length}`)
console.log(`zero importers: ${rows.filter((r) => r.importers === 0).length}`)
console.log(`@deprecated marker in file: ${rows.filter((r) => r.deprecated).length}`)

const orphans = rows.filter((r) => r.importers === 0).sort((a, b) => b.lines - a.lines)
if (orphans.length) {
  console.log('\n--- check zero importers (may be entry hubs) ---')
  for (const r of orphans) console.log(`  ${r.lines}\t${r.file}`)
}

console.log('\n--- stubs (<100 lines) ---')
for (const r of rows.filter((x) => x.lines < 100).sort((a, b) => a.lines - b.lines)) {
  console.log(`  ${r.lines}\t${r.importers} imp\t${r.file}`)
}
