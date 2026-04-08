const { spawnSync } = require('node:child_process')

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', shell: true })
}

function hasPort3000Listener() {
  const out = run('netstat', ['-ano']).stdout || ''
  return out.includes(':3000') && out.includes('LISTENING')
}

const allowBusy = process.argv.includes('--allow-busy')
if (process.platform === 'win32' && hasPort3000Listener() && !allowBusy) {
  console.error('[prisma:generate:safe] port 3000 LISTENING detected (likely dev server).')
  console.error('[prisma:generate:safe] stop dev server first, then rerun this command.')
  console.error('[prisma:generate:safe] if you want to bypass check, use: npm run prisma:generate:safe -- --allow-busy')
  process.exit(1)
}

const res = run('npx', ['prisma', 'generate'])
if (res.stdout) process.stdout.write(res.stdout)
if (res.stderr) process.stderr.write(res.stderr)

const combined = `${res.stdout || ''}\n${res.stderr || ''}`
if ((res.status || 0) !== 0 && combined.includes('EPERM: operation not permitted, rename')) {
  console.error('\n[prisma:generate:safe] Windows file lock detected on query_engine.')
  console.error('[prisma:generate:safe] recovery: stop dev server -> npm run prisma:generate:safe -> npm run dev:clean')
}

process.exit(res.status || 0)
