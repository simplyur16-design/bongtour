/**
 * 비교 클러스터 모자란 공급사 → 등록대기 우선 수집 (수동 CLI)
 *
 *   npx tsx scripts/data/tmp-ingest-compare-cluster-gaps.ts --place=방콕 --duration="3박 5일"
 *   npx tsx scripts/data/tmp-ingest-compare-cluster-gaps.ts --place=상해 --apply --per-supplier=1
 *   npx tsx scripts/data/tmp-ingest-compare-cluster-gaps.ts --presets --apply
 *
 * REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: CLI forced searchWord — manifest
 */
import { existsSync } from 'fs'
import path from 'path'
import { config } from 'dotenv'

const ROOT = process.cwd()
for (const f of ['.env.local', '.env']) {
  const p = path.join(ROOT, f)
  if (existsSync(p)) config({ path: p, override: f === '.env.local' })
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`))
  return hit ? hit.slice(name.length + 1) : undefined
}

async function main() {
  const { DEV_COMPARE_PRESETS } = await import('../../lib/dev-similar-itinerary-compare')
  const { ingestCompareClusterSupplierGaps } = await import(
    '../../lib/compare-cluster-supplier-gap-ingest'
  )

  const apply = process.argv.includes('--apply')
  const presets = process.argv.includes('--presets')
  const place = arg('--place')
  const duration = arg('--duration')
  const only = arg('--only')
  const perRaw = arg('--per-supplier')
  const perSupplier = perRaw ? Math.max(1, Number(perRaw) || 1) : 1
  const onlySuppliers = only
    ? only
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null

  const jobs = presets
    ? DEV_COMPARE_PRESETS.map((p) => ({ place: p.place, duration: p.duration }))
    : place
      ? [{ place, duration: duration ?? null }]
      : [{ place: DEV_COMPARE_PRESETS[0].place, duration: DEV_COMPARE_PRESETS[0].duration }]

  if (!apply) {
    console.error('[compare-cluster-gap-ingest] dry-run (pass --apply to write pending)')
  }

  for (const job of jobs) {
    console.error('[compare-cluster-gap-ingest] job', job)
    const result = await ingestCompareClusterSupplierGaps({
      place: job.place,
      duration: job.duration,
      onlySuppliers,
      perSupplier,
      dryRun: !apply,
    })
    console.log(JSON.stringify(result, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
