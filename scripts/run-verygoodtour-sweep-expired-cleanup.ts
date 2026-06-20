/**
 * verygoodtour URL inventory에서 expired=true 상품만 horizonSoldOut sweep (출발 prune).
 *
 *   npx tsx scripts/run-verygoodtour-sweep-expired-cleanup.ts
 *   npx tsx scripts/run-verygoodtour-sweep-expired-cleanup.ts --dry-run
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { sweepDueVerygoodtourProducts } from '@/lib/verygoodtour-sweep'

const INVENTORY_PATH = path.join(process.cwd(), 'ops', 'verygoodtour-url-health-inventory.json')

type InventoryItem = {
  slug: string
  id: string
  expired: boolean
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (!fs.existsSync(INVENTORY_PATH)) {
    console.error(`missing inventory: ${INVENTORY_PATH}`)
    process.exit(1)
  }
  const inv = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as {
    items?: InventoryItem[]
  }
  const expired = (inv.items ?? []).filter((x) => x.expired)
  if (expired.length === 0) {
    console.log(JSON.stringify({ ok: true, expired: 0, message: 'no expired items' }, null, 2))
    return
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        { mode: 'dry-run', expired: expired.map((x) => ({ slug: x.slug, id: x.id })) },
        null,
        2,
      ),
    )
    return
  }

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const results: Array<{ slug: string; id: string; sweep: Awaited<ReturnType<typeof sweepDueVerygoodtourProducts>> }> =
    []

  for (const item of expired) {
    console.error(`[expired-cleanup] sweep slug=${item.slug}`)
    const sweep = await sweepDueVerygoodtourProducts(prisma, { productId: item.id, limit: 1 })
    results.push({ slug: item.slug, id: item.id, sweep })
    console.error(
      `[expired-cleanup] done slug=${item.slug} soldOut=${sweep.horizonSoldOut} pruned=${sweep.pruned}`,
    )
  }

  console.log(JSON.stringify({ ok: true, cleaned: results.length, results }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
