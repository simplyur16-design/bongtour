#!/usr/bin/env node
/**
 * Baseline: mark all prisma/migrations (with migration.sql) as applied.
 * Idempotent — already-applied migrations are skipped by prisma migrate resolve.
 */
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = join(import.meta.dirname, '..', '..')
const migrationsDir = join(root, 'prisma', 'migrations')

const names = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => existsSync(join(migrationsDir, name, 'migration.sql')))
  .sort()

const total = names.length
console.log(`Resolving ${total} migrations as applied...`)

let success = 0
let skipped = 0
let failed = 0
let lastError = null

for (let i = 0; i < names.length; i++) {
  const name = names[i]
  const n = i + 1
  console.log(`[${n}/${total}] prisma migrate resolve --applied "${name}"`)

  const r = spawnSync('npx', ['prisma', 'migrate', 'resolve', '--applied', name], {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  })

  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
  if (out) console.log(out)

  if (r.status === 0) {
    if (/already recorded as applied/i.test(out)) skipped++
    else success++
    console.log(`[${n}/${total}] OK`)
  } else {
    failed++
    lastError = { name, status: r.status, out }
    console.error(`[${n}/${total}] FAILED (exit ${r.status})`)
    if (/already recorded as applied/i.test(out)) {
      skipped++
      failed--
      console.log(`[${n}/${total}] treated as skip (already applied)`)
    }
  }
}

console.log('')
console.log(`Summary: success=${success} skip=${skipped} failed=${failed} total=${total}`)
if (lastError && failed > 0) {
  console.error('Last failure:', JSON.stringify(lastError, null, 2))
  process.exit(1)
}
