/**
 * Cross-platform `python -m <module>` for npm verify scripts.
 * Windows has no `sh` / `command -v` — do not use `sh -c` in package.json.
 * REGRESSION-FREEZE[hanatour-e2e-airtel-same-product]: Windows-safe python runner — manifest
 */
import { spawnSync } from 'node:child_process'

const moduleName = process.argv[2]
if (!moduleName) {
  console.error('usage: node scripts/run-python-module.mjs <python.module.name>')
  process.exit(2)
}

const cwd = process.cwd()
const env = { ...process.env, PYTHONPATH: cwd }

/** @type {Array<[string, string[]]>} */
const candidates = [
  ['python3', ['-m', moduleName]],
  ['python', ['-m', moduleName]],
  ['py', ['-3', '-m', moduleName]],
]

for (const [bin, args] of candidates) {
  const r = spawnSync(bin, args, { stdio: 'inherit', env, cwd, shell: false })
  if (r.error?.code === 'ENOENT') continue
  if (r.status == null && r.error) {
    console.error(`[run-python-module] ${bin} failed:`, r.error.message)
    continue
  }
  process.exit(r.status ?? 1)
}

console.error(
  '[run-python-module] no python3/python/py found — install Python 3 to run',
  moduleName,
)
process.exit(127)
