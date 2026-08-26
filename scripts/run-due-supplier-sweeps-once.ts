/**
 * 일일 due-select로 hanatour·ybtour·verygoodtour 가격 sweep 1회.
 * 실행: npx tsx scripts/run-due-supplier-sweeps-once.ts
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'

import { sweepDueHanatourProducts } from '@/lib/hanatour-sweep'
import { sweepDueVerygoodtourProducts } from '@/lib/verygoodtour-sweep'
import { sweepDueYbtourProducts } from '@/lib/ybtour-sweep'

async function main() {
  const prisma = new PrismaClient()
  try {
    console.error('[due-sweep] hanatour start')
    const hanatour = await sweepDueHanatourProducts(prisma, { limit: 200 })
    console.error('[due-sweep] hanatour', JSON.stringify(hanatour))

    console.error('[due-sweep] ybtour start')
    const ybtour = await sweepDueYbtourProducts(prisma, { limit: 200 })
    console.error('[due-sweep] ybtour', JSON.stringify(ybtour))

    console.error('[due-sweep] verygoodtour start')
    const verygoodtour = await sweepDueVerygoodtourProducts(prisma, { limit: 200 })
    console.error('[due-sweep] verygoodtour', JSON.stringify(verygoodtour))

    console.log(JSON.stringify({ ok: true, hanatour, ybtour, verygoodtour }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
