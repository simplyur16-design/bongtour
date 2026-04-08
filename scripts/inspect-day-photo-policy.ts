import { prisma } from '../lib/prisma'
import { buildItineraryDayPhotoCandidates } from '../lib/itinerary-day-photo-candidates'

type PickedProduct = {
  id: string
  originSource: string
  destination: string | null
  title: string
}

function pickBySource(products: PickedProduct[], keyword: RegExp): PickedProduct | null {
  return products.find((p) => keyword.test(p.originSource)) ?? null
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      itineraryDays: { some: {} },
    },
    select: {
      id: true,
      originSource: true,
      destination: true,
      title: true,
    },
    take: 80,
    orderBy: { updatedAt: 'desc' },
  })

  const targets = [
    pickBySource(products, /모두|mode/i),
    pickBySource(products, /verygood|참좋은/i),
  ].filter(Boolean) as PickedProduct[]

  const out: unknown[] = []

  for (const p of targets) {
    const scheduleJson = await prisma.product.findUnique({
      where: { id: p.id },
      select: { schedule: true },
    })
    const schedule = (() => {
      try {
        return JSON.parse(scheduleJson?.schedule ?? '[]') as Array<Record<string, unknown>>
      } catch {
        return []
      }
    })()

    const days = await prisma.itineraryDay.findMany({
      where: { productId: p.id },
      orderBy: { day: 'asc' },
      select: { day: true, city: true, poiNamesRaw: true, summaryTextRaw: true, rawBlock: true },
      take: 4,
    })
    const used = new Set<string>()
    const dayRows = days.map((d) => {
      const sched = schedule.find((x) => Number(x.day ?? 0) === d.day)
      const candidates = buildItineraryDayPhotoCandidates({
        destination: p.destination ?? '',
        city: d.city,
        poiNamesRaw: d.poiNamesRaw,
        summaryTextRaw: d.summaryTextRaw,
        rawBlock: d.rawBlock,
        scheduleTitle: typeof sched?.title === 'string' ? sched.title : undefined,
        scheduleDescription: typeof sched?.description === 'string' ? sched.description : undefined,
        scheduleImageKeyword: typeof sched?.imageKeyword === 'string' ? sched.imageKeyword : undefined,
        excludeKeys: used,
      })
      if (candidates[0]) used.add(candidates[0].semanticKey)
      return {
        day: d.day,
        input: {
          city: d.city,
          poiNamesRaw: d.poiNamesRaw,
          summaryTextRaw: d.summaryTextRaw,
          rawBlock: d.rawBlock ? `${d.rawBlock.slice(0, 140)}...` : null,
        },
        topCandidates: candidates.slice(0, 4),
      }
    })
    out.push({
      product: { id: p.id, originSource: p.originSource, destination: p.destination, title: p.title },
      days: dayRows,
    })
  }

  console.log(JSON.stringify({ ok: true, result: out }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
