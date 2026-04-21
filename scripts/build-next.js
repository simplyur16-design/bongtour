/**
 * next build with one automatic retry (max 2 attempts).
 * Mitigates intermittent Windows races where app-paths-manifest is read
 * before route entries are fully written (PageNotFoundError during build).
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const maxAttempts = 2

/** Prefer repo .env / .env.local so a stale shell DATABASE_URL cannot break SQLite builds. */
function databaseUrlFromRepoEnvFiles() {
  let out
  for (const name of ['.env', '.env.local']) {
    const p = path.join(root, name)
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line)
      if (!m) continue
      let v = m[1].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      out = v
    }
  }
  return out
}

const buildEnv = { ...process.env }
const fromFiles = databaseUrlFromRepoEnvFiles()
if (fromFiles) buildEnv.DATABASE_URL = fromFiles

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const r = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: root,
    env: buildEnv,
    stdio: 'inherit',
  })
  if (r.status === 0) process.exit(0)
  if (attempt < maxAttempts) {
    console.error('\n[build-next] next build failed; retrying once…\n')
  }
}

process.exit(1)
