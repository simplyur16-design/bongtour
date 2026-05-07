/**
 * B-publish: 5분마다 네이버 블로그 마케팅 예약 알림(Solapi) + scheduled→published 자동 전환.
 */
export function startInstrumentationPublishReminderCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_PUBLISH_REMINDER_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '*/5 * * * *',
        () => {
          void tickPublishReminderCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log('[publish-reminder-cron] registered: */5 * * * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[publish-reminder-cron] failed to load node-cron', e)
    })
}

async function tickPublishReminderCron() {
  try {
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[publish-reminder-cron] skip: DATABASE_URL')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const { runPublishReminderTick } = await import('@/lib/bong-marketing/publish-reminder')
    const r = await runPublishReminderTick(prisma)
    console.log(
      '[publish-reminder-cron] tick',
      JSON.stringify({
        transitioned: r.transitions.transitionedIds.length,
        remindersCandidates: r.reminders.candidates.length,
        remindersSent: r.reminders.sentIds.length,
        dryRun: r.reminders.dryRun,
        skippedNoRecipient: r.reminders.skippedNoRecipient,
        reminderErrors: r.reminders.errors.length,
      }),
    )
  } catch (e) {
    console.error('[publish-reminder-cron] error', e)
  }
}
