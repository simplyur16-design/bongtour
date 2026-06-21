/**
 * 공급사별 중복 등록 상품 감사·교정.
 * 실행: npx tsx scripts/audit-supplier-duplicate-products.ts [--apply]
 */
import './load-env-for-scripts'

import { prisma } from '../lib/prisma'
import {
  groupProductsByRegisterDedupeKey,
  pickDuplicateProductKeeper,
  type RegisterExistingProductRow,
} from '../lib/register-product-duplicate-guard'

const apply = process.argv.includes('--apply')

async function main() {
  const rows = await prisma.product.findMany({
    select: {
      id: true,
      originSource: true,
      originCode: true,
      originUrl: true,
      registrationStatus: true,
      title: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const groups = groupProductsByRegisterDedupeKey(rows as RegisterExistingProductRow[])
  if (groups.length === 0) {
    console.log('duplicate groups: 0')
    return
  }

  console.log(`duplicate groups: ${groups.length}`)
  let rejectCount = 0

  for (const group of groups) {
    const keeper = pickDuplicateProductKeeper(group.products)
    const losers = group.products.filter((p) => p.id !== keeper.id)
    console.log('')
    console.log(`[${group.canonicalSupplier}] ${group.dedupeKey}`)
    console.log(`  keep: ${keeper.id} (${keeper.registrationStatus}) ${keeper.originCode} — ${keeper.title.slice(0, 60)}`)
    for (const loser of losers) {
      console.log(`  dupe: ${loser.id} (${loser.registrationStatus}) ${loser.originCode} — ${loser.title.slice(0, 60)}`)
      if (apply && loser.registrationStatus !== 'rejected') {
        await prisma.product.update({
          where: { id: loser.id },
          data: {
            registrationStatus: 'rejected',
            hasUrgentDeal: false,
            urgentDealNextDate: null,
          },
        })
        rejectCount += 1
        console.log(`  -> rejected ${loser.id}`)
      }
    }
  }

  if (apply) {
    console.log(`\napplied: rejected ${rejectCount} duplicate product(s)`)
  } else {
    console.log('\n(dry-run — pass --apply to mark duplicates as rejected)')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
