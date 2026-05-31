import './load-env-for-scripts'
import { prisma } from '@/lib/prisma'

async function main() {
  const rows = await prisma.$queryRaw<
    {
      id: string
      cycleId: string
      cycleStartDate: Date
      seasonMessage: string
      heroImageUrl: string | null
      plus1: number
      plus2: number
      plus3: number
    }[]
  >`
    SELECT id, "cycleId", "cycleStartDate", "seasonMessage", "heroImageUrl",
           jsonb_array_length("linkedProductIds"->'2026-06') as plus1,
           jsonb_array_length("linkedProductIds"->'2026-07') as plus2,
           jsonb_array_length("linkedProductIds"->'2026-08') as plus3
    FROM "AirHotelSeasonCuration"
    WHERE "cycleId" = '2026-05'
  `
  console.log(JSON.stringify(rows, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
