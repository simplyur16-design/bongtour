import { execSync } from 'child_process'
import { loadEnvForScripts } from './load-env-for-scripts'

loadEnvForScripts()

function run(cmd: string): { ok: true; out: string } | { ok: false; out: string } {
  try {
    return { ok: true, out: execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string }
    return { ok: false, out: [e.stdout, e.stderr].filter(Boolean).join('\n').trim() }
  }
}

const status = run('npx prisma migrate status')
console.log(status.out)

const pending =
  !status.ok ||
  /Following migration have not yet been applied|Database schema is out of sync/i.test(status.out)

if (pending) {
  console.log('\n[check-prisma-migrate] pending migrations — running deploy…')
  const deploy = run('npx prisma migrate deploy')
  console.log(deploy.out)
  if (!deploy.ok) process.exit(1)
} else {
  console.log('\n[check-prisma-migrate] OK — no pending migrations')
}

const verify = run('npx prisma migrate status')
console.log(verify.out)
if (!verify.ok) process.exit(1)
