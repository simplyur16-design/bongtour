import './load-env-for-scripts'
import { runRegisterPrePhotoDailyJob } from '../lib/register-pre-photo-daily-job'
import { healPendingRegisterPrePhoto } from '../lib/register-pending-pre-photo-self-heal'

const dryRun = process.argv.includes('--dry-run')
const probe = !process.argv.includes('--no-probe')
const ingest = process.argv.includes('--ingest')

console.error('[register-pre-photo-daily] boot', { ingest, dryRun, probe, pid: process.pid })

if (ingest) {
  runRegisterPrePhotoDailyJob({ dryRun, probeImageUrls: probe })
    .then((result) => {
      console.log('[register-pre-photo-daily]', result)
      process.exit(result.heal.failed + result.ingest.failed > 0 ? 1 : 0)
    })
    .catch((e) => {
      console.error('[register-pre-photo-daily] failed', e)
      process.exit(1)
    })
} else {
  healPendingRegisterPrePhoto({ limit: 40, dryRun, probeImageUrls: probe })
    .then((result) => {
      console.log('[heal-pending-register-pre-photo]', result)
      process.exit(result.failed > 0 ? 1 : 0)
    })
    .catch((e) => {
      console.error('[heal-pending-register-pre-photo] failed', e)
      process.exit(1)
    })
}
