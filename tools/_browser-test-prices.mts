import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const id = 'cmnvfupq400061xuldipptqfp'
const r = await p.product.findUnique({
  where: { id },
  include: { prices: { orderBy: { date: 'asc' } } },
})
console.log(
  JSON.stringify(
    {
      originSource: r?.originSource,
      priceCount: r?.prices?.length ?? 0,
      firstDates: r?.prices?.slice(0, 5).map((x) => ({
        raw: x.date,
        iso: x.date instanceof Date ? x.date.toISOString() : String(x.date),
      })),
      lastDates: r?.prices?.slice(-2).map((x) => ({
        raw: x.date,
        iso: x.date instanceof Date ? x.date.toISOString() : String(x.date),
      })),
    },
    null,
    2
  )
)
await p.$disconnect()
