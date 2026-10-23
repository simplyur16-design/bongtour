import '../load-env-for-scripts'
import { PrismaClient } from '@prisma/client'
import { getScheduleFromProduct } from '../../lib/schedule-from-product'
import { getFinalCoverImageUrl } from '../../lib/final-image-selection'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      OR: [{ bgImageUrl: null }, { bgImageUrl: '' }],
    },
    select: {
      id: true,
      originCode: true,
      title: true,
      bgImageUrl: true,
      schedule: true,
    },
    take: 200,
  })

  const plans: { id: string; originCode: string; cover: string | null; schedDays: number; withUrl: number }[] =
    []
  for (const p of rows) {
    const days = getScheduleFromProduct({ schedule: p.schedule, title: p.title })
    const withUrl = days.filter((d) => String(d.imageUrl || '').trim()).length
    const cover = getFinalCoverImageUrl({ bgImageUrl: null, scheduleDays: days })
    plans.push({
      id: p.id,
      originCode: p.originCode,
      cover,
      schedDays: days.length,
      withUrl,
    })
  }

  console.log(
    JSON.stringify(
      {
        apply: APPLY,
        noCover: rows.length,
        recoverable: plans.filter((x) => x.cover).length,
        stillEmpty: plans.filter((x) => !x.cover).map((x) => ({
          originCode: x.originCode,
          schedDays: x.schedDays,
          withUrl: x.withUrl,
        })),
      },
      null,
      2,
    ),
  )

  if (!APPLY) return
  let n = 0
  for (const plan of plans) {
    if (!plan.cover) continue
    await prisma.product.update({
      where: { id: plan.id },
      data: { bgImageUrl: plan.cover },
    })
    n++
  }
  console.log(`updated=${n}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
