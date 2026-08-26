import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'

const KEYS = ['hanatour', 'modetour', 'verygoodtour', 'ybtour'] as const

async function main() {
  const prisma = new PrismaClient()
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    for (const originSource of KEYS) {
      const rows = await prisma.product.findMany({
        where: {
          originSource,
          registrationStatus: 'registered',
          listingKind: { in: ['travel', 'air_hotel'] },
        },
        select: {
          lastPriceObservedAt: true,
          lastSalesPolicyCheckedAt: true,
        },
      })
      const obs = rows.map((r) => r.lastPriceObservedAt?.getTime() ?? 0).filter((n) => n > 0)
      const pol = rows.map((r) => r.lastSalesPolicyCheckedAt?.getTime() ?? 0).filter((n) => n > 0)
      const maxObs = obs.length ? new Date(Math.max(...obs)).toISOString() : null
      const maxPol = pol.length ? new Date(Math.max(...pol)).toISOString() : null
      const staleObs = rows.filter(
        (r) => !r.lastPriceObservedAt || r.lastPriceObservedAt < cutoff24h,
      ).length
      const freshPol = rows.filter(
        (r) => r.lastSalesPolicyCheckedAt && r.lastSalesPolicyCheckedAt >= cutoff24h,
      ).length
      console.log(
        JSON.stringify({
          originSource,
          registered: rows.length,
          lastPriceObservedAtMax: maxObs,
          lastSalesPolicyCheckedAtMax: maxPol,
          observedOlderThan24h: staleObs,
          salesPolicyCheckedWithin24h: freshPol,
        }),
      )
    }
    const pending = await prisma.product.count({
      where: { registrationStatus: 'pending' },
    })
    console.log(JSON.stringify({ pending }))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
