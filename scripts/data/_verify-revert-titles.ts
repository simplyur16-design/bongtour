import '../load-env-for-scripts'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()
const codes = [
  '2AZZ4278',
  'JPP4044-261021TW',
  'APK2502606067CA',
  'JWP148261001TW6',
  'JWP147261001TWC',
  'JSP148261011TWK',
  'JSP148261030TWK',
  'JKP135260729ZEC',
]

async function main() {
  await p.product.updateMany({
    where: {
      OR: [
        { primaryDestination: { contains: '스타가이드' } },
        { primaryDestination: { contains: '가이드와' } },
      ],
    },
    data: {
      primaryDestination: '홋카이도',
      destination: '홋카이도',
      destinationRaw: '홋카이도',
    },
  })

  // 보홀 short title 잔여
  await p.product.updateMany({
    where: { originCode: 'APK2502606067CA', title: '보홀 4박 6일' },
    data: { title: '보홀 6일#펀다이빙 #발리카삭 #레이트체크아웃 #라메디리조트' },
  })

  const again = await p.product.findMany({
    where: { originCode: { in: codes } },
    select: { originCode: true, title: true, primaryDestination: true },
  })
  console.log(JSON.stringify(again, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await p.$disconnect()
  })
