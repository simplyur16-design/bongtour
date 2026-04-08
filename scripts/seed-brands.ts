/**
 * Brand 테이블 시드. HQ_BRANDS 기반으로 초기 레코드 생성. 30개 확장 시 admin에서 추가.
 */
import { PrismaClient } from '@prisma/client'

const BRANDS = [
  { brandKey: 'hanatour', displayName: '하나투어', sortOrder: 1 },
  { brandKey: 'modetour', displayName: '모두투어', sortOrder: 2 },
  { brandKey: 'ybtour', displayName: '노랑풍선', sortOrder: 3 },
  { brandKey: 'verygoodtour', displayName: '참좋은여행사', sortOrder: 4 },
  { brandKey: 'gyowontour', displayName: '교원투어', sortOrder: 5 },
  { brandKey: 'other', displayName: '기타', sortOrder: 99 },
]

const prisma = new PrismaClient()

async function main() {
  for (const b of BRANDS) {
    await prisma.brand.upsert({
      where: { brandKey: b.brandKey },
      create: {
        brandKey: b.brandKey,
        displayName: b.displayName,
        logoPath: b.brandKey === 'other' ? null : `/logos/${b.brandKey}.png`,
        sortOrder: b.sortOrder,
      },
      update: { displayName: b.displayName, sortOrder: b.sortOrder },
    })
  }
  console.log('Brand seed done:', BRANDS.length)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
