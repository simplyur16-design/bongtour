/**
 * I-7: 마스터 정합 검증 1회 (CLI). 알림 생략: --skip-notify
 *   npx tsx scripts/run-master-integrity-once.ts
 *   npx tsx scripts/run-master-integrity-once.ts --skip-notify
 * DRY_RUN SMS: .env 에 MASTER_INTEGRITY_ALERT_DRY_RUN=true
 *
 * (.mts 대신 .ts: tsconfig exclude 밖 tsx + @/ 경로와 동일 패턴)
 */
import './load-env-for-scripts'

import { runMasterIntegrityScheduledJob } from '@/lib/master-integrity-job'
import { prisma } from '@/lib/prisma'

const skipNotify = process.argv.includes('--skip-notify')

async function main() {
  const report = await runMasterIntegrityScheduledJob({ skipNotify })
  console.log(JSON.stringify({ at: report.at, counts: report.counts }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
