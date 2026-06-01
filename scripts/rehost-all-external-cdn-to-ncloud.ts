/**
 * Memory #5 — DB 전역 외부 CDN URL → NCloud 일괄 재호스팅.
 *
 *   npx tsx scripts/rehost-all-external-cdn-to-ncloud.ts
 *   npx tsx scripts/rehost-all-external-cdn-to-ncloud.ts --apply
 *   npx tsx scripts/rehost-all-external-cdn-to-ncloud.ts --table=PhotoPool --limit=50
 *   npx tsx scripts/rehost-all-external-cdn-to-ncloud.ts --sync-bongsim-flags --apply
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import {
  REHOST_ALL_TABLES,
  type RehostAllTable,
  countExternalCdnUrlsInDb,
  runRehostAllExternalCdn,
} from '../lib/rehost-all-external-cdn-runner'

function parseCli() {
  const apply = process.argv.includes('--apply')
  const syncBongsimFlags = process.argv.includes('--sync-bongsim-flags')
  const countOnly = process.argv.includes('--count-only')

  let limit: number | null = null
  const limArg = process.argv.find((a) => a.startsWith('--limit='))
  if (limArg) {
    const n = Number(limArg.slice('--limit='.length))
    if (Number.isFinite(n) && n > 0) limit = Math.floor(n)
  }

  let pageSize = 200
  const pageArg = process.argv.find((a) => a.startsWith('--page-size='))
  if (pageArg) {
    const n = Number(pageArg.slice('--page-size='.length))
    if (Number.isFinite(n) && n > 0) pageSize = Math.floor(n)
  }

  let concurrency = 1
  const concArg = process.argv.find((a) => a.startsWith('--concurrency='))
  if (concArg) {
    const n = Number(concArg.slice('--concurrency='.length))
    if (Number.isFinite(n) && n > 0) concurrency = Math.floor(n)
  }

  const tableArg = process.argv.find((a) => a.startsWith('--table='))
  let tables: RehostAllTable[] | undefined
  if (tableArg) {
    const raw = tableArg.slice('--table='.length).trim()
    const parts = raw.split(',').map((s) => s.trim()) as RehostAllTable[]
    for (const p of parts) {
      if (!(REHOST_ALL_TABLES as readonly string[]).includes(p)) {
        throw new Error(`Unknown --table=${p}. Allowed: ${REHOST_ALL_TABLES.join(', ')}`)
      }
    }
    tables = parts
  }

  return { apply, syncBongsimFlags, countOnly, limit, pageSize, concurrency, tables }
}

async function main() {
  const cli = parseCli()
  console.log('[rehost-all] mode:', cli.apply ? 'APPLY' : 'dry-run')

  if (cli.countOnly) {
    const { total, byTable } = await countExternalCdnUrlsInDb()
    console.log('[rehost-all] external URL count:', total)
    for (const [k, v] of Object.entries(byTable).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`)
    }
    return
  }

  if (cli.concurrency > 1) {
    console.warn('[rehost-all] concurrency>1 not implemented; using 1')
  }

  await runRehostAllExternalCdn({
    apply: cli.apply,
    tables: cli.tables,
    limit: cli.limit,
    pageSize: cli.pageSize,
    concurrency: 1,
    syncBongsimFlags: cli.syncBongsimFlags,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
