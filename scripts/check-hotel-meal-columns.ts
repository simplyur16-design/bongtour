import { PrismaClient } from '../prisma-gen-runtime'

const prisma = new PrismaClient()

async function main() {
  const pi = (await prisma.$queryRawUnsafe(`PRAGMA table_info(Product)`)) as { name: string }[]
  const id = (await prisma.$queryRawUnsafe(`PRAGMA table_info(ItineraryDay)`)) as { name: string }[]
  const wantP = ['hotelSummaryText']
  const wantI = ['hotelText', 'breakfastText', 'lunchText', 'dinnerText', 'mealSummaryText']
  const pnames = new Set(pi.map((r) => r.name))
  const inames = new Set(id.map((r) => r.name))
  console.log(
    'Product hotelSummaryText:',
    wantP.map((c) => `${c}=${pnames.has(c)}`).join(', ')
  )
  console.log(
    'ItineraryDay:',
    wantI.map((c) => `${c}=${inames.has(c)}`).join(', ')
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
