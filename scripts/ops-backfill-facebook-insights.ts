/**
 * 페북 manual BongPostInsight → Media Views API backfill.
 *
 * npx tsx scripts/ops-backfill-facebook-insights.ts
 * npx tsx scripts/ops-backfill-facebook-insights.ts --apply
 */
import './load-env-for-scripts'
import { backfillFacebookInsightsFromDb } from '@/lib/bong-marketing/insight-sync'

async function main() {
  const apply = process.argv.includes('--apply')

  if (!apply) {
    console.log('[dry-run] --apply 없음. 실제 API·DB 갱신은 실행하지 않습니다.')
    console.log('  npx tsx scripts/ops-backfill-facebook-insights.ts --apply')
    return
  }

  const result = await backfillFacebookInsightsFromDb('manual')

  console.log('=== Facebook insights backfill ===')
  console.log(`성공: ${result.success}건`)
  console.log(`28일 초과 스킵: ${result.skippedOutside28Days}건`)
  console.log(`오류: ${result.errors}건`)
  console.log('--- 상세 ---')
  for (const row of result.details) {
    console.log(`${row.id} | fbPostId=${row.fbPostId ?? '-'} | ${row.status}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
