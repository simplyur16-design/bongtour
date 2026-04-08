/**
 * next build with one automatic retry (max 2 attempts).
 * Mitigates intermittent Windows races where app-paths-manifest is read
 * before route entries are fully written (PageNotFoundError during build).
 */
const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const maxAttempts = 2

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const r = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  if (r.status === 0) process.exit(0)
  if (attempt < maxAttempts) {
    console.error('\n[build-next] next build failed; retrying once…\n')
  }
}

process.exit(1)
