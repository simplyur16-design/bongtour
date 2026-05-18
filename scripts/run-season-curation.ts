/**
 * 로컬/운영 DB에 시즌 추천 도시 사이클 생성 (HTTP cron 시크릿 불필요).
 * 사용: npx tsx scripts/run-season-curation.ts [--force]
 */
import './load-env-for-scripts'
import { getCurrentCycle } from '../lib/season-curation'
import { runSeasonCurationJob } from '../lib/season-curation-job'

const force = process.argv.includes('--force')

async function main() {
  const now = new Date()
  console.log('[run-season-curation] start', now.toISOString())

  const before = await getCurrentCycle(now)
  console.log('[run-season-curation] active cycle before:', before?.id ?? '(none)')

  const result = await runSeasonCurationJob(now, { force })
  console.log('[run-season-curation] job:', {
    ok: result.ok,
    rotated: result.rotated,
    cycleId: result.cycle?.id ?? null,
    message: result.message ?? null,
  })

  if (!result.ok) {
    process.exitCode = 1
    return
  }

  const after = await getCurrentCycle(now)
  console.log('[run-season-curation] active cycle after:', after?.id ?? '(none)')
  console.log('[run-season-curation] done')
}

main().catch((e) => {
  console.error('[run-season-curation] fatal', e)
  process.exitCode = 1
})
