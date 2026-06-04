/**
 * modetour 패키지 단건 가격·출발 즉시 리뉴잉 (21:00 cron 대기 없이).
 *
 *   npm run db:sync-modetour-price -- --slug pkg-mt-0058
 *   npm run db:sync-modetour-price -- --id <productId>
 *   npm run db:sync-modetour-price -- --slug pkg-mt-0058 --dry-run
 *
 * SSOT: `lib/modetour-departures` `collectModetourDepartureInputs` (B2C API, 관리자 재수집과 동일) →
 *       `lib/apply-product-calendar-price-items` + `lib/upsert-product-departures-modetour` →
 *       `rebuildProductPublicDetailPayload` / `revalidateProductDetailCaches`
 *
 * (참고) 21:00 `calendar_price_scheduler.py` 는 modetour 도 Python E2E 를 쓸 수 있음 — 단건 즉시 갱신은 API 경로.
 *
 * 백업: `scripts/data/backups/modetour-price-sync-<slug>-<timestamp>.json`
 */
import './load-env-for-scripts'

import { prisma } from '@/lib/prisma'
import { runSyncModetourPriceSingle } from '@/lib/sync-modetour-price-single'

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  const v = process.argv[i + 1]?.trim()
  return v || null
}

async function main() {
  const slug = readArg('--slug')
  const productId = readArg('--id')
  const dryRun = process.argv.includes('--dry-run')
  const skipPayloadRebuild = process.argv.includes('--skip-payload-rebuild')

  const result = await runSyncModetourPriceSingle(prisma, {
    slug,
    productId,
    dryRun,
    skipPayloadRebuild,
  })

  console.log(JSON.stringify(result, null, 2))

  if (!result.ok) {
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
