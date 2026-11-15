/**
 * 교정 회귀 얼림 — manifest SSOT 일괄 실행.
 * npx tsx scripts/verify-regression-freeze.ts --tier prebuild|ci|all
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  appendGithubStepSummary,
  classifyNestedNpmExit,
  LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE,
} from '../lib/regression-freeze/live-gate-external'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

type Tier = 'prebuild' | 'ci' | 'all'

type NestedNpmEntry = { script: string; tier?: Tier[]; requiresDatabase?: boolean; externalNetworkSkip?: boolean }

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
    /**
     * static guard 직후 실행할 npm script (live gate 등) — 문자열 또는 { script, tier, requiresDatabase, externalNetworkSkip }.
     * externalNetworkSkip=true인 항목만 종료코드 78을 외부 장애 SKIP으로 집계한다.
     */
    npmScripts?: Array<string | NestedNpmEntry>
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

/**
 * 동일 `npm run <script>`는 한 freeze 실행에서 한 번만.
 * staticGuards nested에 verify:register-pre-photo-self-heal 등이 수십 번 붙어
 * Railway prebuild가 20분+로 늘어나는 것을 막는다.
 * REGRESSION-FREEZE[regression-freeze-npm-script-dedupe]: 동일 script 중복 실행 금지 — manifest
 */
function createNpmScriptRunner(ran: Set<string>): (script: string, label: string) => void {
  return (script: string, label: string) => {
    if (ran.has(script)) {
      console.log(`[regression-freeze] ⊘ skip duplicate npm run ${script} (${label})`)
      return
    }
    ran.add(script)
    runNpmScript(script, label)
  }
}

function databaseUrlConfigured(): boolean {
  const raw = (process.env.DATABASE_URL ?? '').trim()
  if (!raw) return false
  // GitHub Actions regression-freeze / security-checks: Prisma init용 더미 URL (DB 없음)
  // REGRESSION-FREEZE[overseas-hub-server-geo-fetch]: skip CI placeholder DB — manifest
  if (/@(?:127\.0\.0\.1|localhost):5432\b/i.test(raw)) return false
  return true
}

/**
 * nested npmScripts tier — 문자열·객체 모두 기본 `ci`.
 * Railway prebuild에 dual-slot·self-heal·live verify가 문자열로 붙어 빌드가 폭주하던 구멍 차단.
 * prebuild에 넣을 때만 `{ script, tier: ["prebuild"] }` 명시.
 * REGRESSION-FREEZE[regression-freeze-prebuild-npm-tier]: nested string 기본 ci — manifest
 */
function guardNpmScriptsForTier(
  guard: { npmScripts?: Array<string | NestedNpmEntry> },
  runTier: Tier,
): Array<{ script: string; requiresDatabase?: boolean; externalNetworkSkip?: boolean }> {
  const out: Array<{ script: string; requiresDatabase?: boolean; externalNetworkSkip?: boolean }> = []
  for (const entry of guard.npmScripts ?? []) {
    if (typeof entry === 'string') {
      // REGRESSION-FREEZE[regression-freeze-prebuild-npm-tier]: nested string 기본 ci — manifest
      if (tierMatch(['ci'], runTier)) out.push({ script: entry })
      continue
    }
    const script = entry?.script?.trim()
    if (!script) continue
    if (tierMatch(entry.tier ?? ['ci'], runTier)) {
      out.push({
        script,
        requiresDatabase: entry.requiresDatabase,
        externalNetworkSkip: entry.externalNetworkSkip === true,
      })
    }
  }
  return out
}

/**
 * externalNetworkSkip 항목 — 종료코드 78만 SKIP, 그 외 비정상 종료는 FAIL.
 * REGRESSION-FREEZE[live-gate-external-skip]: 허용 게이트만 SKIP 집계 — manifest
 */
function runExternalSkipNpmScript(
  script: string,
  label: string,
  ranScripts: Set<string>,
  externalSkips: string[],
): void {
  if (ranScripts.has(script)) {
    console.log(`[regression-freeze] ⊘ skip duplicate npm run ${script} (${label})`)
    return
  }
  ranScripts.add(script)
  console.log(`\n[regression-freeze] ▶ ${label} (npm run ${script}, external SKIP=${LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE})`)
  const r = spawnSync(`npm run ${script}`, { cwd: ROOT, stdio: 'inherit', env: process.env, shell: true })
  const verdict = classifyNestedNpmExit(r.status, true)
  if (verdict === 'skip') {
    console.warn(`[regression-freeze] ⊘ SKIP[external] ${label}`)
    externalSkips.push(label)
    return
  }
  if (verdict === 'fail') throw new Error(`exit ${r.status ?? r.signal ?? 'unknown'}`)
}

function runStaticGuards(
  manifest: Manifest,
  runTier: Tier,
  failures: string[],
  runNpmOnce: (script: string, label: string) => void,
  ranScripts: Set<string>,
  externalSkips: string[],
  active: Set<string> | null = null,
  owners: Map<string, string> | null = null,
  completed: string[] | null = null,
): void {
  const guards = manifest.staticGuards.filter((g) => tierMatch(g.tier, runTier))
  for (const guard of guards) {
    const key = `static:${guard.id}`
    if (active && !active.has(key)) continue
    const failuresBefore = failures.length
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
    for (const nested of guardNpmScriptsForTier(guard, runTier)) {
      if (nested.requiresDatabase && !databaseUrlConfigured()) {
        console.warn(
          `[regression-freeze] ⊘ skip nested npm ${guard.id} → ${nested.script} (requiresDatabase — no reachable DATABASE_URL)`,
        )
        continue
      }
      const label = `${guard.id} → npm run ${nested.script}`
      if (!npmOwnedHere(nested.script, label, active, owners)) continue
      try {
        if (nested.externalNetworkSkip) {
          runExternalSkipNpmScript(nested.script, label, ranScripts, externalSkips)
        } else {
          runNpmOnce(nested.script, label)
        }
      } catch {
        console.error(`\n[FAIL] regression-freeze nested npm: ${guard.id} (${nested.script})`)
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
          runFreezeTestFile(guard.id, file)
        }
      }
    }
    if (completed && failures.length === failuresBefore) completed.push(key)
  }
}

// REGRESSION-FREEZE[theme-travel-mingling-mega-menu]: tests/ uses node:test not vitest — manifest
// REGRESSION-FREEZE[schedule-poi-regex-ssot-node-test]: tests/schedule-poi-regex-ssot.test.ts is node:test — manifest
/** tests/ 아래는 node:test SSOT — vitest include가 lib|app만이라 CI에서 빈 필터로 깨진다. */
function isNodeTestSourceFile(rel: string): boolean {
  if (rel.startsWith('tests/')) return true
  try {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    return /from ['"]node:test['"]/.test(src)
  } catch {
    return false
  }
}

function runFreezeTestFile(guardId: string, file: string): void {
  const rel = file.replace(/\\/g, '/')
  if (isNodeTestSourceFile(rel)) {
    console.log(`\n[regression-freeze] ▶ node:test ${guardId} → ${rel}`)
    execSync(`npx tsx --test ${rel}`, { cwd: ROOT, stdio: 'inherit', env: process.env })
    return
  }
  console.log(`\n[regression-freeze] ▶ vitest ${guardId} → ${rel}`)
  execSync(`npx vitest run ${rel}`, { cwd: ROOT, stdio: 'inherit', env: process.env })
}

function vitestInstalled(): boolean {
  try {
    require.resolve('vitest/config')
    return true
  } catch {
    return false
  }
}

function runVitestSuites(
  manifest: Manifest,
  runTier: Tier,
  active: Set<string> | null = null,
  completed: string[] | null = null,
): number {
  // Railway/Nixpacks build: NODE_ENV=production → npm install omits devDependencies (no vitest).
  if (runTier === 'prebuild') {
    return 0
  }
  const suites = manifest.vitestSuites.filter((s) => tierMatch(s.tier, runTier) && (!active || active.has(`vitest:${s.id}`)))
  if (suites.length === 0) return 0
  if (!vitestInstalled()) {
    throw new Error(
      'vitest devDependency not installed — run npm install (with devDeps) before verify:regression-freeze:ci',
    )
  }
  for (const suite of suites) {
    if (!Array.isArray(suite.files) || suite.files.length === 0) {
      console.warn(`[regression-freeze] ⊘ skip vitest suite ${suite.id} (no files — move to staticGuards?)`)
      completed?.push(`vitest:${suite.id}`)
      continue
    }
    const nodeTestFiles = suite.files
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => isNodeTestSourceFile(f))
    const vitestFiles = suite.files
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => !isNodeTestSourceFile(f))
    if (nodeTestFiles.length > 0) {
      console.log(`\n[regression-freeze] ▶ node:test ${suite.id}`)
      execSync(`npx tsx --test ${nodeTestFiles.join(' ')}`, {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
      })
    }
    if (vitestFiles.length > 0) {
      console.log(`\n[regression-freeze] ▶ vitest ${suite.id}`)
      execSync(`npx vitest run ${vitestFiles.join(' ')}`, {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
      })
    }
    completed?.push(`vitest:${suite.id}`)
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

/**
 * CI 샤드 균형용 가중치(초). run 43695206293 실측에서 15초 이상인 항목만.
 * 배치에만 쓰고, 가드를 빼거나 합치지 않는다.
 */
const SHARD_WEIGHT_SECONDS: Record<string, number> = {
  'static:ybtour-register-taiwan-live-gate': 501,
  'static:modetour-register-samples-live-gate': 151,
  'npm:kyowontour-tour-event-tab-opt-shop': 91,
  'static:modetour-register-danang-live-gate': 82,
  'static:schedule-poi-regex-ssot': 46,
  'static:register-schedule-trip-image-keyword-dedupe': 44,
  'static:register-schedule-image-keyword-gemini-fill': 27,
  'static:pexels-keyword-taiwan-poi': 27,
  'static:naeiltour-register-2azz3346-airtel-live-gate': 23,
  'static:hanatour-register-samples-live-gate': 22,
  'vitest:vitest-regression-core': 22,
  'static:register-schedule-forbidden-city-route-evidence': 18,
  'static:register-hk-gogung-not-taipei-npm': 18,
  'static:naeiltour-register-mezz32084-live-gate': 17,
  'npm:register-confirm-mega-menu-image-guard': 17,
  'static:hanatour-price-api-anchor-gate': 16,
  'static:register-pre-photo-bare-city-middle-repeat': 16,
  'static:modetour-105133652-live-gate': 15,
  'static:lottetour-register-godid-hokkaido-live-gate': 15,
}
const DEFAULT_SHARD_WEIGHT_SECONDS = 1

type WorkItem = { key: string; weight: number }

function argvValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = argv.indexOf(name)
  if (i >= 0) return argv[i + 1]
  return undefined
}

function tierExplicit(argv: string[]): boolean {
  return argv.some((a) => a === '--tier' || a.startsWith('--tier='))
}

function parseShardSpec(raw: string): { index: number; count: number } {
  const m = /^(\d+)\/(\d+)$/.exec(raw.trim())
  if (!m) throw new Error(`--shard must be i/n, got ${raw}`)
  const index = Number(m[1])
  const count = Number(m[2])
  if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 1 || index > count) {
    throw new Error(`--shard out of range: ${raw}`)
  }
  return { index, count }
}

function ciWorkItems(manifest: Manifest, runTier: Tier): WorkItem[] {
  const items: WorkItem[] = []
  const push = (key: string) => {
    items.push({ key, weight: SHARD_WEIGHT_SECONDS[key] ?? DEFAULT_SHARD_WEIGHT_SECONDS })
  }
  for (const guard of manifest.staticGuards) {
    if (tierMatch(guard.tier, runTier)) push(`static:${guard.id}`)
  }
  for (const entry of manifest.npmScripts) {
    if (tierMatch(entry.tier, runTier)) push(`npm:${entry.id}`)
  }
  for (const suite of manifest.vitestSuites) {
    if (tierMatch(suite.tier, runTier)) push(`vitest:${suite.id}`)
  }
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.key)) throw new Error(`duplicate freeze work key ${item.key}`)
    seen.add(item.key)
  }
  return items
}

/** 무거운 항목부터 가장 가벼운 샤드에 넣는다. 샤드 안에서는 manifest 순서를 유지한다. */
function assignShards(items: WorkItem[], count: number): WorkItem[][] {
  const shards: WorkItem[][] = Array.from({ length: count }, () => [])
  const load = Array.from({ length: count }, () => 0)
  const byWeight = [...items].sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  for (const item of byWeight) {
    let best = 0
    for (let i = 1; i < count; i++) {
      if (load[i] < load[best]) best = i
    }
    shards[best].push(item)
    load[best] += item.weight
  }
  const order = new Map(items.map((item, index) => [item.key, index]))
  for (const shard of shards) {
    shard.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0))
  }
  assertShardPartition(items, shards)
  return shards
}

/** 누락·중복이면 예외. 목록 출력·샤드 실행·리포트 검사가 같은 함수를 쓴다. */
function assertShardPartition(items: WorkItem[], shards: WorkItem[][]): void {
  const owner = new Map<string, number>()
  for (let i = 0; i < shards.length; i++) {
    for (const item of shards[i]) {
      const prev = owner.get(item.key)
      if (prev != null) throw new Error(`duplicate ${item.key} on shard ${prev} and ${i + 1}`)
      owner.set(item.key, i + 1)
    }
  }
  const missing = items.filter((item) => !owner.has(item.key)).map((item) => item.key)
  if (missing.length > 0 || owner.size !== items.length) {
    throw new Error(
      `shard partition ${owner.size}/${items.length}, missing ${missing.slice(0, 8).join(', ')}`,
    )
  }
}

function printShardPlan(items: WorkItem[], shards: WorkItem[][]): void {
  shards.forEach((shard, index) => {
    const weight = shard.reduce((sum, item) => sum + item.weight, 0)
    console.log(`shard ${index + 1}/${shards.length} items=${shard.length} weight=${weight}`)
    for (const item of shard) console.log(`  ${item.key}`)
  })
  console.log(`partition ok items=${items.length} shards=${shards.length}`)
}

/**
 * 동일 npm script 는 전체 CI에서 한 번만. 소유 가드가 다른 샤드면 여기서 다시 실행하지 않는다.
 * 실행 순서는 샤드 없는 단일 실행과 같다(static → top-level npm).
 */
function buildNpmOwner(manifest: Manifest, runTier: Tier): Map<string, string> {
  const owner = new Map<string, string>()
  const claim = (script: string, key: string) => {
    if (!owner.has(script)) owner.set(script, key)
  }
  for (const guard of manifest.staticGuards) {
    if (!tierMatch(guard.tier, runTier)) continue
    for (const nested of guardNpmScriptsForTier(guard, runTier)) {
      if (nested.requiresDatabase && !databaseUrlConfigured()) continue
      claim(nested.script, `static:${guard.id}`)
    }
  }
  for (const entry of manifest.npmScripts) {
    if (!tierMatch(entry.tier, runTier)) continue
    if (entry.requiresDatabase && !databaseUrlConfigured()) continue
    claim(entry.script, `npm:${entry.id}`)
  }
  return owner
}

function npmOwnedHere(script: string, label: string, active: Set<string> | null, owners: Map<string, string> | null): boolean {
  if (!active || !owners) return true
  const owner = owners.get(script)
  if (owner && !active.has(owner)) {
    console.log(`[regression-freeze] ⊘ npm ${script} runs on ${owner} (${label})`)
    return false
  }
  return true
}

type ShardReport = { shard: number; count: number; tier: Tier; completed: string[] }

function readShardReportFiles(dir: string): ShardReport[] {
  const out: ShardReport[] = []
  const walk = (current: string) => {
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name)
      if (ent.isDirectory()) walk(full)
      else if (ent.name === 'freeze-shard-report.json') {
        out.push(JSON.parse(fs.readFileSync(full, 'utf8')) as ShardReport)
      }
    }
  }
  if (!fs.existsSync(dir)) throw new Error(`shard report dir missing: ${dir}`)
  walk(dir)
  return out
}

function checkShardReports(manifest: Manifest, runTier: Tier, dir: string, count: number): void {
  const items = ciWorkItems(manifest, runTier)
  const expected = assignShards(items, count)
  const reports = readShardReportFiles(dir)
  if (reports.length !== count) {
    throw new Error(`shard reports ${reports.length}, expected ${count}`)
  }
  const seen = new Set<number>()
  for (const report of reports) {
    if (report.tier !== runTier || report.count !== count) {
      throw new Error(`shard report header mismatch shard=${report.shard} tier=${report.tier} count=${report.count}`)
    }
    if (seen.has(report.shard)) throw new Error(`duplicate shard report ${report.shard}`)
    seen.add(report.shard)
    const want = expected[report.shard - 1]?.map((item) => item.key) ?? []
    const got = report.completed
    if (got.length !== want.length || got.some((key, index) => key !== want[index])) {
      throw new Error(`shard ${report.shard} completed ${got.length} keys, expected ${want.length}`)
    }
  }
  for (let shard = 1; shard <= count; shard++) {
    if (!seen.has(shard)) throw new Error(`missing shard report ${shard}`)
  }
  console.log(`[ok] regression-freeze shard coverage items=${items.length} shards=${count}`)
}

function main() {
  const argv = process.argv.slice(2)
  const runTier = parseTier(argv)
  const manifest = readManifest()
  const listShardsRaw = argvValue(argv, '--list-shards')
  const checkDir = argvValue(argv, '--check-shard-reports')
  const shardRaw = argvValue(argv, '--shard')
  const reportPath = argvValue(argv, '--shard-report')
  const planTier: Tier = runTier === 'list' || !tierExplicit(argv) ? 'ci' : runTier

  if (listShardsRaw != null) {
    const count = Number(listShardsRaw)
    if (!Number.isInteger(count) || count < 1) throw new Error(`--list-shards must be a positive integer, got ${listShardsRaw}`)
    const items = ciWorkItems(manifest, planTier)
    printShardPlan(items, assignShards(items, count))
    return
  }

  if (checkDir) {
    const count = shardRaw ? parseShardSpec(shardRaw).count : Number(argvValue(argv, '--shard-count') ?? '4')
    if (!Number.isInteger(count) || count < 1) throw new Error(`--shard-count invalid`)
    checkShardReports(manifest, planTier, checkDir, count)
    return
  }

  if (runTier === 'list') {
    printManifestList(manifest)
    return
  }

  const failures: string[] = []
  const ranScripts = new Set<string>()
  const externalSkips: string[] = []
  const completed: string[] = []
  const runNpmOnce = createNpmScriptRunner(ranScripts)
  let active: Set<string> | null = null
  let owners: Map<string, string> | null = null
  let shardLabel = ''
  if (shardRaw) {
    const spec = parseShardSpec(shardRaw)
    const items = ciWorkItems(manifest, runTier)
    const shardItems = assignShards(items, spec.count)[spec.index - 1] ?? []
    active = new Set(shardItems.map((item) => item.key))
    owners = buildNpmOwner(manifest, runTier)
    shardLabel = ` shard=${spec.index}/${spec.count} items=${active.size}`
  }

  console.log(`[regression-freeze] manifest=${manifest.version} tier=${runTier}${shardLabel}`)

  verifyRegressionFreezeMarkers(manifest, failures)
  runStaticGuards(manifest, runTier, failures, runNpmOnce, ranScripts, externalSkips, active, owners, completed)

  if (failures.length) {
    console.error('\n[FAIL] regression-freeze static/markers')
    for (const f of failures) console.error(`  - ${f}`)
    process.exit(1)
  }

  const scripts = manifest.npmScripts.filter((s) => tierMatch(s.tier, runTier) && (!active || active.has(`npm:${s.id}`)))
  for (const entry of scripts) {
    if (entry.requiresDatabase && !databaseUrlConfigured()) {
      console.warn(
        `[regression-freeze] ⊘ skip ${entry.id} (requiresDatabase — DATABASE_URL unset; run locally/Railway for DB tier)`,
      )
      completed.push(`npm:${entry.id}`)
      continue
    }
    const label = `${entry.id}: ${entry.summary}`
    if (!npmOwnedHere(entry.script, label, active, owners)) {
      completed.push(`npm:${entry.id}`)
      continue
    }
    try {
      runNpmOnce(entry.script, label)
    } catch {
      console.error(`\n[FAIL] regression-freeze npm script: ${entry.id} (${entry.script})`)
      process.exit(1)
    }
    completed.push(`npm:${entry.id}`)
  }

  let vitestCount = 0
  try {
    vitestCount = runVitestSuites(manifest, runTier, active, completed)
  } catch (err) {
    console.error('\n[FAIL] regression-freeze vitest suite')
    if (err instanceof Error && err.message) console.error(`  ${err.message}`)
    process.exit(1)
  }

  if (shardRaw && reportPath) {
    const spec = parseShardSpec(shardRaw)
    const report: ShardReport = { shard: spec.index, count: spec.count, tier: runTier, completed }
    fs.writeFileSync(path.join(ROOT, reportPath), JSON.stringify(report, null, 2))
  }

  const vitestLabel = vitestCount > 0 ? ` + ${vitestCount} vitest` : ''
  const skipLabel = externalSkips.length > 0 ? `, ${externalSkips.length} SKIP[external]` : ''
  console.log(`\n[ok] regression-freeze tier=${runTier}${shardLabel} (${scripts.length} npm + static${vitestLabel}${skipLabel})`)
  if (externalSkips.length > 0) {
    for (const s of externalSkips) console.warn(`  SKIP[external] ${s}`)
    appendGithubStepSummary(
      [`### Regression Freeze: ${externalSkips.length} SKIP[external]`, '', ...externalSkips.map((s) => `- ${s}`), ''].join('\n'),
    )
  }
}

main()
