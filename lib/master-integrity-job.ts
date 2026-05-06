/**
 * I-7: 정합 검증 실행 + (옵션) Solapi 운영자 알림.
 */
import { formatMasterIntegritySms, runMasterIntegrityCheck } from '@/lib/master-integrity'
import { sendAdminOperationalLms } from '@/lib/notification-service'
import { prisma } from '@/lib/prisma'

export async function runMasterIntegrityScheduledJob(opts?: {
  /** true면 이상 건수가 있어도 SMS/LMS 미발송 */
  skipNotify?: boolean
}) {
  const report = await runMasterIntegrityCheck(prisma)
  console.log(
    '[master-integrity-job]',
    JSON.stringify({ at: report.at, counts: report.counts, brokenTotal: report.counts.brokenTotal }),
  )

  if (!opts?.skipNotify && report.counts.brokenTotal > 0) {
    await sendAdminOperationalLms(formatMasterIntegritySms(report))
  }

  return report
}
