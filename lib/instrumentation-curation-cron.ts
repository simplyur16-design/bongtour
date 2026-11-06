/**
 * 매월 20일 09:00 (Asia/Seoul) — 홈 노출 월 범위(당월·+1/+2/+3) 시즌 큐레이션 초안 확보.
 * 기존 `generateMonthlyCuration(..., { overwrite: false })` 재사용.
 * 이미 행이 있으면 EXISTS로 건너뜀(수동 생성·이전 자동 생성 덮어쓰지 않음).
 * GEMINI_API_KEY, DATABASE_URL 필요.
 */
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import {
  HOME_SEASON_ENSURE_MONTH_OFFSETS,
  homeSeasonMonthKeysFromBase,
} from '@/lib/season-curation-content'

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
      console.log(
        '[curation-cron] registered: 0 9 20 * * (Asia/Seoul) — ensure drafts for current/+1/+2/+3',
      )
    })
    .catch((e) => {
      console.error('[curation-cron] failed to load node-cron', e)
    })
}

/** 테스트·수동 호출용 — overwrite 없이 노출 월 초안만 채움 */
export async function ensureHomeSeasonMonthlyCurationDrafts(
  baseYearMonth = getSeoulYearMonthNow(),
): Promise<{
  base: string
  monthKeys: string[]
  results: { monthKey: string; status: 'created' | 'exists' | 'skipped' | 'error'; detail?: string; created?: number }[]
}> {
  const monthKeys = homeSeasonMonthKeysFromBase(baseYearMonth, HOME_SEASON_ENSURE_MONTH_OFFSETS)
  const results: {
    monthKey: string
    status: 'created' | 'exists' | 'skipped' | 'error'
    detail?: string
    created?: number
  }[] = []

  if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) {
    for (const monthKey of monthKeys) {
      results.push({ monthKey, status: 'skipped', detail: 'no GEMINI_API_KEY / GOOGLE_API_KEY' })
    }
    return { base: baseYearMonth, monthKeys, results }
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    for (const monthKey of monthKeys) {
      results.push({ monthKey, status: 'skipped', detail: 'no DATABASE_URL' })
    }
    return { base: baseYearMonth, monthKeys, results }
  }

  const { generateMonthlyCuration } = await import('@/lib/gemini-curation')
  for (const monthKey of monthKeys) {
    const r = await generateMonthlyCuration(monthKey, { overwrite: false })
    if (!r.ok) {
      if (r.code === 'EXISTS') {
        results.push({ monthKey, status: 'exists', detail: r.error })
        continue
      }
      results.push({ monthKey, status: 'error', detail: `${r.code ?? ''} ${r.error}`.trim() })
      continue
    }
    results.push({ monthKey, status: 'created', created: r.created })
  }
  return { base: baseYearMonth, monthKeys, results }
}

async function tickCurationCron() {
  try {
    const summary = await ensureHomeSeasonMonthlyCurationDrafts()
    console.log('[curation-cron] ensure drafts', summary)
  } catch (e) {
    console.error('[curation-cron] error', e)
  }
}
