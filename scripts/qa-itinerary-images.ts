/**
 * 일회성 QA: ItineraryDay + schedule 이미지가 채워진 상품 1건 덤프
 * 실행: npx tsx scripts/qa-itinerary-images.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 * (`includes('모두')` 등은 **로컬 DB 레거시 표기** 샘플 고르기용이며, 복붙 입력 예시가 아니다.)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.product.findMany({
    where: {
      itineraryDays: { some: {} },
      schedule: { not: null },
      NOT: { schedule: '' },
    },
    select: {
      id: true,
      originSource: true,
      originCode: true,
      title: true,
      destination: true,
      bgImageUrl: true,
      bgImageSourceUrl: true,
      bgImageExternalId: true,
      bgImageSource: true,
      schedule: true,
    },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  })

  const scored = rows
    .map((p) => {
      let days = 0
      try {
        const s = JSON.parse(p.schedule || '[]') as unknown
        days = Array.isArray(s) ? s.length : 0
      } catch {
        days = 0
      }
      return { ...p, _scheduleDays: days }
    })
    .filter((p) => p._scheduleDays >= 3)

  const modetour = scored.find((p) => p.originSource.includes('모두') || p.title.includes('모두'))
  const pick = modetour ?? scored[0]

  if (!pick) {
    console.log(JSON.stringify({ error: 'no product with 3+ schedule days and itineraryDays' }, null, 2))
    return
  }

  const itineraryDays = await prisma.itineraryDay.findMany({
    where: { productId: pick.id },
    orderBy: { day: 'asc' },
  })

  let scheduleParsed: unknown = []
  try {
    scheduleParsed = JSON.parse(pick.schedule || '[]')
  } catch {
    /* empty */
  }

  console.log(
    JSON.stringify(
      {
        product: {
          id: pick.id,
          originSource: pick.originSource,
          originCode: pick.originCode,
          title: pick.title,
          destination: pick.destination,
          bgImageUrl: pick.bgImageUrl,
          bgImageSource: pick.bgImageSource,
          bgImageSourceUrl: pick.bgImageSourceUrl,
          bgImageExternalId: pick.bgImageExternalId,
        },
        scheduleDays: (scheduleParsed as unknown[]).length,
        schedule: scheduleParsed,
        itineraryDays,
      },
      null,
      2
    )
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
