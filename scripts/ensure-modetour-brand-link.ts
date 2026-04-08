/**
 * E2E 전제: Brand(modetour) 존재 + 모두투어 origin 상품 1건에 brand 연결 + 첫 출발일 아동가 보강.
 *   npx tsx scripts/ensure-modetour-brand-link.ts
 */
import { prisma } from '../lib/prisma'

async function main() {
  await prisma.brand.upsert({
    where: { brandKey: 'modetour' },
    create: {
      brandKey: 'modetour',
      displayName: '모두투어',
      logoPath: '/logos/modetour.png',
      sortOrder: 2,
    },
    update: { displayName: '모두투어' },
  })
  const brand = await prisma.brand.findUniqueOrThrow({ where: { brandKey: 'modetour' } })

  const product = await prisma.product.findFirst({
    where: { originSource: '모두투어' },
    orderBy: { updatedAt: 'desc' },
    include: { departures: { orderBy: { departureDate: 'asc' }, take: 1 } },
  })
  if (!product) {
    console.error('originSource=모두투어 인 상품이 없습니다.')
    process.exit(1)
    return
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { brandId: brand.id },
  })

  const dep = product.departures[0]
  if (dep) {
    const adult = dep.adultPrice ?? 0
    const infant = dep.infantPrice ?? Math.round(adult * 0.5)
    await prisma.productDeparture.update({
      where: { id: dep.id },
      data: {
        childBedPrice: dep.childBedPrice ?? adult,
        childNoBedPrice: dep.childNoBedPrice ?? Math.max(0, Math.round(adult * 0.85)),
        infantPrice: dep.infantPrice ?? infant,
      },
    })
  }

  console.log('OK linked product', product.id, '→ brand modetour', brand.id)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
