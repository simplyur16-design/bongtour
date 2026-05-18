/**
 * 시즌 추천 도시 사이클 — HTTP cron·instrumentation·스크립트 공통 실행 본문.
 */
import {
  ensureSeasonDestinationCyclesForMonthOffsets,
  rotateCycleIfDue,
} from '@/lib/season-curation'
import type { SeasonalDestinationCuration } from '@prisma/client'

export type RunSeasonCurationJobResult = {
  ok: boolean
  rotated: boolean
  cycle: SeasonalDestinationCuration | null
  message?: string
}

export async function runSeasonCurationJob(
  now = new Date(),
  opts?: { force?: boolean },
): Promise<RunSeasonCurationJobResult> {
  const result = await rotateCycleIfDue(now, { force: Boolean(opts?.force) })
  if (result.message && !result.cycle) {
    return { ok: false, rotated: result.rotated, cycle: null, message: result.message }
  }
  await ensureSeasonDestinationCyclesForMonthOffsets([1, 2, 3], now)
  return { ok: true, rotated: result.rotated, cycle: result.cycle, message: result.message }
}
