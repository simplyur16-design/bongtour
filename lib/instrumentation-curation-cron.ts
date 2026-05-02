/**
 * 매월 20일 09:00 (Asia/Seoul) — 다음 달 시즌 큐레이션 초안 생성 (미발행).
 * GEMINI_API_KEY, DATABASE_URL 필요. 기존 다음 달 초안이 있으면 건너뜀(덮어쓰지 않음).
 */
function nextMonthKey(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function startInstrumentationCurationCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_CURATION_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 9 20 * *',
        () => {
          void tickCurationCron()
        },
        { timezone: 'Asia/Seoul' }
      )
      console.log('[curation-cron] registered: 0 9 20 * * (Asia/Seoul) — next-month draft')
    })
    .catch((e) => {
      console.error('[curation-cron] failed to load node-cron', e)
    })
}

async function tickCurationCron() {
  try {
    if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) {
      console.warn('[curation-cron] skip: no GEMINI_API_KEY / GOOGLE_API_KEY')
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[curation-cron] skip: DATABASE_URL')
      return
    }
    const { generateMonthlyCuration } = await import('@/lib/gemini-curation')
    const targetMonth = nextMonthKey()
    const r = await generateMonthlyCuration(targetMonth, { overwrite: false })
    if (!r.ok) {
      if (r.code === 'EXISTS') {
        console.log('[curation-cron] skip already exists', targetMonth)
        return
      }
      console.warn('[curation-cron]', r.code ?? '', r.error)
      return
    }
    console.log('[curation-cron] created', r.created, 'for', r.targetMonth)
  } catch (e) {
    console.error('[curation-cron] error', e)
  }
}
