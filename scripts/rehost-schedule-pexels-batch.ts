/**
 * @deprecated 호환 wrapper — SSOT: scripts/rehost-all-external-cdn-to-ncloud.ts (Product.schedule)
 *
 * Run: npx tsx scripts/rehost-schedule-pexels-batch.ts --dry-run
 * Apply: npx tsx scripts/rehost-schedule-pexels-batch.ts --apply
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { runRehostAllExternalCdn } from '../lib/rehost-all-external-cdn-runner'

function parseCli() {
  const apply = process.argv.includes('--apply')
  let maxProducts: number | null = null
  let pageSize = 200
  const limArg = process.argv.find((a) => a.startsWith('--limit='))
  if (limArg) {
    const n = Number(limArg.slice('--limit='.length))
    if (Number.isFinite(n) && n > 0) maxProducts = Math.floor(n)
  }
  const pageArg = process.argv.find((a) => a.startsWith('--page-size='))
  if (pageArg) {
    const n = Number(pageArg.slice('--page-size='.length))
    if (Number.isFinite(n) && n > 0) pageSize = Math.floor(n)
  }
  return { apply, maxProducts, pageSize }
}

async function main() {
  const { apply, maxProducts, pageSize } = parseCli()
  const result = await runRehostAllExternalCdn({
    apply,
    tables: ['Product'],
    onlyProductSchedule: true,
    limit: maxProducts,
    pageSize,
  })
  const product = result.byTable.Product ?? { scanned: 0, changed: 0, failed: 0 }
  console.log(
    '[rehost-schedule-pexels-batch] scanned',
    product.scanned,
    'changed',
    product.changed,
    apply ? '(applied)' : '(dry-run)',
    maxProducts != null ? `limit=${maxProducts}` : '(all pages)',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
