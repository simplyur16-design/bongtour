/**
 * One-shot checks before deploy: current commit vs origin/main (optional fetch),
 * tsconfig exclude sanity, and `tsc --noEmit` (same project as Next typecheck).
 * Usage: npm run verify:deploy-readiness
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function runGit(args, opts = {}) {
  return execSync(['git', ...args].join(' '), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  }).trim()
}

function hasRef(ref) {
  try {
    runGit(['rev-parse', '--verify', ref])
    return true
  } catch {
    return false
  }
}

console.log('[verify:deploy-readiness] repo:', root)

let head = ''
try {
  head = runGit(['rev-parse', 'HEAD'])
  console.log('[verify:deploy-readiness] HEAD:', head)
} catch (e) {
  console.error('[verify:deploy-readiness] FAIL: not a git repo or git missing')
  process.exit(1)
}

try {
  runGit(['fetch', 'origin', 'main'], { stdio: ['ignore', 'ignore', 'ignore'] })
} catch {
  console.log('[verify:deploy-readiness] WARN: git fetch origin main failed (offline or no remote); skip sync check')
}

const originMain = 'origin/main'
if (hasRef(originMain)) {
  const remote = runGit(['rev-parse', originMain])
  console.log('[verify:deploy-readiness] origin/main:', remote)
  if (head === remote) {
    console.log('[verify:deploy-readiness] OK: HEAD matches origin/main')
  } else {
    console.log('[verify:deploy-readiness] WARN: HEAD !== origin/main — pull before deploy if you expect latest main')
  }
} else {
  console.log('[verify:deploy-readiness] WARN: no', originMain, '(fetch remote or add tracking)')
}

const tsconfigPath = path.join(root, 'tsconfig.json')
try {
  const raw = fs.readFileSync(tsconfigPath, 'utf8')
  const ts = JSON.parse(raw)
  const ex = Array.isArray(ts.exclude) ? ts.exclude : []
  if (ex.includes('scripts')) {
    console.log('[verify:deploy-readiness] OK: tsconfig excludes scripts/ (CLI-only TS does not block tsc here)')
  } else {
    console.log('[verify:deploy-readiness] NOTE: tsconfig exclude has no "scripts" — tsc may typecheck scripts/')
  }
} catch {
  console.log('[verify:deploy-readiness] WARN: could not read tsconfig.json')
}

console.log('[verify:deploy-readiness] running check-register-supplier-cross-imports …')
try {
  execSync('node scripts/check-register-supplier-cross-imports.mjs', { cwd: root, stdio: 'inherit' })
} catch {
  console.error('[verify:deploy-readiness] FAIL: register supplier cross-import check')
  process.exit(1)
}

console.log('[verify:deploy-readiness] running npx tsc -p . --noEmit …')
try {
  execSync('npx tsc -p . --noEmit', { cwd: root, stdio: 'inherit', shell: true })
} catch {
  console.error('[verify:deploy-readiness] FAIL: tsc --noEmit')
  process.exit(1)
}

console.log('[verify:deploy-readiness] OK: tsc --noEmit passed')
process.exit(0)
