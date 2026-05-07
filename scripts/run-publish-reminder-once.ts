/**
 * B-publish cron 로직 1회 실행 (로컬·운영 점검용)
 *
 *   npx tsx scripts/run-publish-reminder-once.ts
 *   npx tsx scripts/run-publish-reminder-once.ts --skip-notify
 *
 * --skip-notify: Solapi 미발송·publishReminderSentAt 미기록 (PUBLISH_REMINDER_DRY_RUN 과 동일)
 */
import './load-env-for-scripts'

import { runPublishReminderTick } from '@/lib/bong-marketing/publish-reminder'
import { prisma } from '@/lib/prisma'

function iso(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString()
}

async function main() {
  const skipNotify = process.argv.includes('--skip-notify')
  if (skipNotify) {
    process.env.PUBLISH_REMINDER_DRY_RUN = 'true'
  }

  const r = await runPublishReminderTick(prisma)

  const out = {
    transitions: {
      candidateIds: r.transitions.candidates.map((c) => c.id),
      candidateTitles: r.transitions.candidates.map((c) => ({ id: c.id, title: c.title, scheduledAt: iso(c.scheduledAt) })),
      transitionedIds: r.transitions.transitionedIds,
    },
    reminders: {
      candidateIds: r.reminders.candidates.map((c) => c.id),
      candidateDetail: r.reminders.candidates.map((c) => ({
        id: c.id,
        title: c.title,
        contentTrack: c.contentTrack,
        scheduledAt: iso(c.scheduledAt),
      })),
      sentIds: r.reminders.sentIds,
      dryRun: r.reminders.dryRun,
      skippedNoRecipient: r.reminders.skippedNoRecipient,
      errors: r.reminders.errors,
    },
  }

  console.log(JSON.stringify(out, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
