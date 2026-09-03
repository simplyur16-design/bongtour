/**
 * REGRESSION-FREEZE[auth-login-emaxconn-retry]: login retries EMAXCONN; outbox must not heal — manifest
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const errors: string[] = []

function mustInclude(rel: string, needles: string[]) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8')
  for (const n of needles) {
    if (!src.includes(n)) errors.push(`${rel} missing ${n}`)
  }
}

mustInclude('auth.ts', [
  'REGRESSION-FREEZE[auth-login-emaxconn-retry]',
  "withPrismaRetry",
  "'auth.credentials'",
])
mustInclude('app/api/auth/naver/callback/route.ts', [
  'REGRESSION-FREEZE[auth-login-emaxconn-retry]',
  'withPrismaRetry',
  "'auth.naver.account'",
])
mustInclude('lib/instrumentation-bongsim-order-paid-outbox-cron.ts', [
  'REGRESSION-FREEZE[auth-login-emaxconn-retry]',
  'shouldSkipCatalogHealBecauseSaturated',
])
mustInclude('lib/bongsim/db/pool.ts', [
  'REGRESSION-FREEZE[auth-login-emaxconn-retry]',
  'isBongsimPgSaturatedMaxClients(err)',
])

if (errors.length) {
  for (const e of errors) console.error(e)
  process.exit(1)
}
console.log('[ok] auth-login-emaxconn-retry')
