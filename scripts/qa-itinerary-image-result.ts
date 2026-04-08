import { prisma } from '../lib/prisma'
import { POST as processImagesPost } from '../app/api/travel/process-images/route'

type ProductPick = {
  id: string
  originSource: string
  title: string
}

function pickBySource(items: ProductPick[], re: RegExp): ProductPick | null {
  return items.find((x) => re.test(x.originSource)) ?? null
}

async function runOne(product: ProductPick) {
  const req = new Request('http://localhost/api/travel/process-images', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: product.id, debug: true }),
  })
  const res = await processImagesPost(req as unknown as Request)
  const payload = (await res.json()) as {
    success?: boolean
    error?: string
    debug?: {
      hero: { imageUrl: string; imageSource: string; semanticKey: string }
      slots: Array<{
        day: number
        imageUrl: string
        imageSource: string
        candidateOrigin: string
        semanticKey: string
        fallbackUsed: boolean
        fallbackReason?: string
      }>
    }
  }
  if (!res.ok || !payload?.success || !payload.debug) {
    return { product, ok: false, error: payload?.error ?? `HTTP ${res.status}` }
  }
  const hero = payload.debug.hero
  const slots = payload.debug.slots
  const semanticDup = new Set<string>()
  const dupeDays: number[] = []
  for (const s of slots) {
    if (semanticDup.has(s.semanticKey)) dupeDays.push(s.day)
    semanticDup.add(s.semanticKey)
  }
  const heroUrlNorm = hero.imageUrl.trim().toLowerCase()
  const heroOverlapDays = slots
    .filter((s) => s.imageUrl.trim().toLowerCase() === heroUrlNorm)
    .map((s) => s.day)

  return {
    product,
    ok: true,
    hero,
    slots,
    duplicateSemanticDays: dupeDays,
    heroOverlapDays,
    fallbackDays: slots.filter((s) => s.fallbackUsed).map((s) => s.day),
  }
}

async function main() {
  const products = await prisma.product.findMany({
    where: { itineraryDays: { some: {} }, schedule: { not: null } },
    select: { id: true, originSource: true, title: true },
    orderBy: { updatedAt: 'desc' },
    take: 120,
  })
  const modetour = pickBySource(products, /모두|mode/i)
  const verygood = pickBySource(products, /verygood|참좋은/i)
  const targets = [modetour, verygood].filter(Boolean) as ProductPick[]
  const reports = []
  for (const p of targets) {
    // eslint-disable-next-line no-await-in-loop
    reports.push(await runOne(p))
  }
  console.log(JSON.stringify({ ok: true, reports }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
