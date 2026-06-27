/**
 * 교정 회귀 얼림 — manifest SSOT 일괄 실행.
 * npx tsx scripts/verify-regression-freeze.ts --tier prebuild|ci|all
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

type Tier = 'prebuild' | 'ci' | 'all'

type Manifest = {
  version: string
  npmScripts: Array<{
    id: string
    tier: Tier[]
    script: string
    summary: string
    doc?: string
    /** true면 DATABASE_URL 없을 때 CI 러너가 스크립트 실행을 생략한다. */
    requiresDatabase?: boolean
  }>
  staticGuards: Array<{
    id: string
    tier: Tier[]
    summary: string
    checks: Array<{
      file: string
      mustInclude?: string[]
      mustNotInclude?: string[]
    }>
    /** static guard 직후 실행할 npm script (live gate 등) — 문자열 또는 { script, tier } */
    npmScripts?: Array<string | { script: string; tier?: Tier[] }>
    /** static guard에 묶인 vitest 파일 — manifest staticGuards[].vitestSuites 레거시 키도 허용 */
    vitestSuites?: string[]
  }>
  vitestSuites: Array<{
    id: string
    tier: Tier[]
    summary: string
    files: string[]
  }>
}

const MARKER_RE = /REGRESSION-FREEZE\[([a-z0-9-]+)\]/g

function parseTier(argv: string[]): Tier | 'list' {
  if (argv.includes('--list')) return 'list'
  const raw = argv.find((a) => a.startsWith('--tier'))?.split('=')[1] ?? argv[argv.indexOf('--tier') + 1]
  if (raw === 'prebuild' || raw === 'ci' || raw === 'all') return raw
  return 'prebuild'
}

function printManifestList(manifest: Manifest): void {
  console.log(`\n=== Regression Freeze manifest ${manifest.version} ===\n`)
  const sections: Array<{ label: string; rows: Array<{ id: string; tier: string[]; summary: string }> }> = [
    {
      label: 'npmScripts',
      rows: manifest.npmScripts.map((s) => ({ id: s.id, tier: s.tier, summary: s.summary })),
    },
    {
      label: 'staticGuards',
      rows: manifest.staticGuards.map((s) => ({ id: s.id, tier: s.tier, summary: s.summary })),
    },
    {
      label: 'vitestSuites',
      rows: manifest.vitestSuites.map((s) => ({ id: s.id, tier: s.tier, summary: s.summary })),
    },
  ]
  for (const sec of sections) {
    console.log(`[${sec.label}]`)
    for (const r of sec.rows) {
      console.log(`  ${r.id}  tier=${r.tier.join(',')}  ${r.summary}`)
    }
    console.log('')
  }
  const total = manifest.npmScripts.length + manifest.staticGuards.length + manifest.vitestSuites.length
  console.log(`total frozen items: ${total}`)
  console.log('run: npm run verify:regression-freeze:prebuild | :ci | (all)')
}

function tierMatch(entryTiers: Tier[], runTier: Tier): boolean {
  if (runTier === 'all') return true
  if (runTier === 'ci') return entryTiers.includes('ci') || entryTiers.includes('prebuild')
  return entryTiers.includes(runTier)
}

function readManifest(): Manifest {
  const p = path.join(__dirname, 'regression-freeze-manifest.json')
  return JSON.parse(fs.readFileSync(p, 'utf8')) as Manifest
}

function runNpmScript(script: string, label: string): void {
  console.log(`\n[regression-freeze] ▶ ${label} (npm run ${script})`)
  execSync(`npm run ${script}`, { cwd: ROOT, stdio: 'inherit', env: process.env })
}

function databaseUrlConfigured(): boolean {
  return Boolean((process.env.DATABASE_URL ?? '').trim())
}

function guardNpmScriptsForTier(
  guard: { npmScripts?: Array<string | { script: string; tier?: Tier[] }> },
  runTier: Tier,
): string[] {
  const out: string[] = []
  for (const entry of guard.npmScripts ?? []) {
    if (typeof entry === 'string') {
      out.push(entry)
      continue
    }
    const script = entry?.script?.trim()
    if (!script) continue
    if (tierMatch(entry.tier ?? ['ci'], runTier)) out.push(script)
  }
  return out
}

function runStaticGuards(manifest: Manifest, runTier: Tier, failures: string[]): void {
  const guards = manifest.staticGuards.filter((g) => tierMatch(g.tier, runTier))
  for (const guard of guards) {
    for (const check of guard.checks ?? []) {
      const full = path.join(ROOT, check.file)
      if (!fs.existsSync(full)) {
        failures.push(`[${guard.id}] missing file: ${check.file}`)
        continue
      }
      const text = fs.readFileSync(full, 'utf8')
      for (const needle of check.mustInclude ?? []) {
        if (!text.includes(needle)) {
          failures.push(`[${guard.id}] ${check.file} must include: ${needle}`)
        }
      }
      for (const needle of check.mustNotInclude ?? []) {
        if (text.includes(needle)) {
          failures.push(`[${guard.id}] ${check.file} must NOT include: ${needle}`)
        }
      }
    }
    console.log(`[regression-freeze] ✓ static ${guard.id}`)
    for (const script of guardNpmScriptsForTier(guard, runTier)) {
      try {
        runNpmScript(script, `${guard.id} → npm run ${script}`)
      } catch {
        console.error(`\n[FAIL] regression-freeze nested npm: ${guard.id} (${script})`)
        process.exit(1)
      }
    }
    const guardVitestFiles = guard.vitestSuites ?? []
    if (guardVitestFiles.length > 0) {
      // Railway prebuild: NODE_ENV=production → vitest devDep 없음. static mustInclude만 prebuild.
      if (runTier === 'prebuild') {
        console.log(`[regression-freeze] ⊘ skip vitest ${guard.id} (prebuild tier — ci only)`)
      } else if (!vitestInstalled()) {
        throw new Error(
          'vitest devDependency not installed — run npm install (with devDeps) before verify:regression-freeze:ci',
        )
      } else {
        for (const file of guardVitestFiles) {
          const full = path.join(ROOT, file).replace(/\\/g, '/')
          console.log(`\n[regression-freeze] ▶ vitest ${guard.id} → ${file}`)
          execSync(`npx vitest run ${full}`, { cwd: ROOT, stdio: 'inherit', env: process.env })
        }
      }
    }
  }
}

function vitestInstalled(): boolean {
  try {
    require.resolve('vitest/config')
    return true
  } catch {
    return false
  }
}

function runVitestSuites(manifest: Manifest, runTier: Tier): number {
  // Railway/Nixpacks build: NODE_ENV=production → npm install omits devDependencies (no vitest).
  if (runTier === 'prebuild') {
    return 0
  }
  const suites = manifest.vitestSuites.filter((s) => tierMatch(s.tier, runTier))
  if (suites.length === 0) return 0
  if (!vitestInstalled()) {
    throw new Error(
      'vitest devDependency not installed — run npm install (with devDeps) before verify:regression-freeze:ci',
    )
  }
  for (const suite of suites) {
    if (!Array.isArray(suite.files) || suite.files.length === 0) {
      console.warn(`[regression-freeze] ⊘ skip vitest suite ${suite.id} (no files — move to staticGuards?)`)
      continue
    }
    const args = suite.files.map((f) => path.join(ROOT, f).replace(/\\/g, '/')).join(' ')
    console.log(`\n[regression-freeze] ▶ vitest ${suite.id}`)
    execSync(`npx vitest run ${args}`, { cwd: ROOT, stdio: 'inherit', env: process.env })
  }
  return suites.length
}

function collectManifestIds(manifest: Manifest): Set<string> {
  const ids = new Set<string>()
  for (const e of manifest.npmScripts) ids.add(e.id)
  for (const e of manifest.staticGuards) ids.add(e.id)
  for (const e of manifest.vitestSuites) ids.add(e.id)
  return ids
}

function verifyRegressionFreezeMarkers(manifest: Manifest, failures: string[]): void {
  const known = collectManifestIds(manifest)
  const libDir = path.join(ROOT, 'lib')
  const appDir = path.join(ROOT, 'app')
  const dirs = [libDir, appDir]
  const found = new Map<string, string[]>()

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.next') continue
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue
      const text = fs.readFileSync(full, 'utf8')
      let m: RegExpExecArray | null
      MARKER_RE.lastIndex = 0
      while ((m = MARKER_RE.exec(text))) {
        const id = m[1]!
        const rel = path.relative(ROOT, full).replace(/\\/g, '/')
        if (!found.has(id)) found.set(id, [])
        found.get(id)!.push(rel)
      }
    }
  }
  for (const d of dirs) walk(d)

  for (const [id, files] of found) {
    if (!known.has(id)) {
      failures.push(`REGRESSION-FREEZE marker id "${id}" not in manifest (in: ${files.join(', ')})`)
    }
  }
  if (found.size > 0) {
    console.log(`[regression-freeze] ✓ markers ${found.size} id(s) in source`)
  }
}

function main() {
  const runTier = parseTier(process.argv.slice(2))
  const manifest = readManifest()

  if (runTier === 'list') {
    printManifestList(manifest)
    return
  }

  const failures: string[] = []

  console.log(`[regression-freeze] manifest=${manifest.version} tier=${runTier}`)

  verifyRegressionFreezeMarkers(manifest, failures)
  runStaticGuards(manifest, runTier, failures)

  if (failures.length) {
    console.error('\n[FAIL] regression-freeze static/markers')
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }

  const scripts = manifest.npmScripts.filter((s) => tierMatch(s.tier, runTier))
  for (const entry of scripts) {
    if (entry.requiresDatabase && !databaseUrlConfigured()) {
      console.warn(
        `[regression-freeze] ⊘ skip ${entry.id} (requiresDatabase — DATABASE_URL unset; run locally/Railway for DB tier)`,
      )
      continue
    }
    try {
      runNpmScript(entry.script, `${entry.id}: ${entry.summary}`)
    } catch {
      console.error(`\n[FAIL] regression-freeze npm script: ${entry.id} (${entry.script})`)
      process.exit(1)
    }
  }

  let vitestCount = 0
  try {
    vitestCount = runVitestSuites(manifest, runTier)
  } catch (err) {
    console.error('\n[FAIL] regression-freeze vitest suite')
    if (err instanceof Error && err.message) console.error(`  ${err.message}`)
    process.exit(1)
  }

  const vitestLabel = vitestCount > 0 ? ` + ${vitestCount} vitest` : ''
  console.log(`\n[ok] regression-freeze tier=${runTier} (${scripts.length} npm + static${vitestLabel})`)
}

main()
