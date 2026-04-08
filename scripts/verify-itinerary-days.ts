/**
 * ItineraryDay 적재·갱신·조회 흐름 검증 (1건 기준).
 * 실행: DATABASE_URL=file:./prisma/dev.db npx tsx scripts/verify-itinerary-days.ts
 * 또는 절대 경로: node -e "process.env.DATABASE_URL='file:c:/Users/USER/Desktop/BONGTOUR/prisma/dev.db'; require('tsx/cjs')('scripts/verify-itinerary-days.ts')"
 */
import { PrismaClient } from '@prisma/client'
import { upsertItineraryDays } from '../lib/upsert-itinerary-days-hanatour'

const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  console.log('=== A. 테스트 대상 상품 1건 선정 ===')
  let product = await prisma.product.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, originSource: true, originCode: true, title: true, schedule: true },
  })
  if (!product) {
    console.log('상품 없음 → 검증용 상품 1건 생성')
    const created = await prisma.product.create({
      data: {
        originSource: '검증용',
        originCode: 'verify-itinerary-' + Date.now(),
        title: '[검증] ItineraryDay 테스트 상품',
        schedule: JSON.stringify([{ day: 1, title: '1일차', description: '출발', imageUrl: null }, { day: 2, title: '2일차', description: '관광', imageUrl: null }]),
      },
    })
    product = { id: created.id, originSource: created.originSource, originCode: created.originCode, title: created.title, schedule: created.schedule }
  }
  const productId = product.id
  console.log('productId:', productId)
  console.log('originSource:', product.originSource)
  console.log('originCode:', product.originCode)
  console.log('title:', product.title?.slice(0, 50) ?? '')
  console.log('')

  const initialCount = await prisma.itineraryDay.count({ where: { productId } })
  console.log('=== B. 저장 전 ItineraryDay row 수 ===')
  console.log('count:', initialCount)
  console.log('')

  console.log('=== B. 1차 적재 (3일차 샘플) ===')
  await upsertItineraryDays(prisma, productId, [
    { day: 1, summaryTextRaw: '1일차 인천출발, 도착 후 호텔 체크인', rawBlock: '{"title":"1일차","description":"인천출발","imageKeyword":"Airport"}' },
    { day: 2, summaryTextRaw: '2일차 관광지 A, B 방문', poiNamesRaw: 'A, B', rawBlock: '{"title":"2일차","description":"관광","imageKeyword":"Temple"}' },
    { day: 3, summaryTextRaw: '3일차 자유일, 출국', rawBlock: '{"title":"3일차","description":"출국","imageKeyword":"Airport"}' },
  ])
  const afterFirst = await prisma.itineraryDay.findMany({
    where: { productId },
    orderBy: { day: 'asc' },
    select: { id: true, day: true, summaryTextRaw: true, poiNamesRaw: true, rawBlock: true },
  })
  console.log('row 수:', afterFirst.length)
  console.log('day 목록:', afterFirst.map((r) => r.day))
  afterFirst.forEach((r, i) => {
    console.log(`  [${i + 1}] day=${r.day} summaryTextRaw=${r.summaryTextRaw?.slice(0, 30) ?? 'null'} poiNamesRaw=${r.poiNamesRaw ?? 'null'} rawBlock=${r.rawBlock ? '있음' : 'null'}`)
  })
  console.log('')

  console.log('=== E. 재저장 (갱신: 2일차만 내용 변경) ===')
  await upsertItineraryDays(prisma, productId, [
    { day: 1, summaryTextRaw: '1일차 인천출발, 도착 후 호텔 체크인', rawBlock: '{"title":"1일차","description":"인천출발","imageKeyword":"Airport"}' },
    { day: 2, summaryTextRaw: '2일차 [갱신] 관광지 A, B, C 방문', poiNamesRaw: 'A, B, C', rawBlock: '{"title":"2일차","description":"관광 갱신","imageKeyword":"Temple"}' },
    { day: 3, summaryTextRaw: '3일차 자유일, 출국', rawBlock: '{"title":"3일차","description":"출국","imageKeyword":"Airport"}' },
  ])
  const afterSecond = await prisma.itineraryDay.findMany({
    where: { productId },
    orderBy: { day: 'asc' },
    select: { id: true, day: true, summaryTextRaw: true, poiNamesRaw: true },
  })
  console.log('row 수 (재저장 후):', afterSecond.length)
  console.log('day 목록:', afterSecond.map((r) => r.day))
  const secondDayRow = afterSecond.find((r) => r.day === 2)
  console.log('2일차 summaryTextRaw 갱신 여부:', secondDayRow?.summaryTextRaw?.includes('[갱신]') ? '예' : '아니오')
  console.log('2일차 poiNamesRaw:', secondDayRow?.poiNamesRaw ?? 'null')
  const duplicateCheck = await prisma.itineraryDay.groupBy({
    by: ['productId', 'day'],
    where: { productId },
    _count: { id: true },
  })
  const hasDup = duplicateCheck.some((g) => g._count.id > 1)
  console.log('(productId, day) 중복 row 여부:', hasDup ? '있음' : '없음')
  console.log('')

  console.log('=== C. 조회 API와 동일 조건 조회 (API 응답 형태) ===')
  const apiShape = await prisma.itineraryDay.findMany({
    where: { productId },
    orderBy: { day: 'asc' },
    select: {
      id: true,
      productId: true,
      day: true,
      dateText: true,
      city: true,
      summaryTextRaw: true,
      poiNamesRaw: true,
      meals: true,
      accommodation: true,
      transport: true,
      notes: true,
      rawBlock: true,
    },
  })
  console.log('배열 길이:', apiShape.length)
  console.log('day 오름차순:', apiShape.map((r) => r.day).join(', '))
  console.log('필드 존재: id, productId, day, dateText, city, summaryTextRaw, poiNamesRaw, meals, accommodation, transport, notes, rawBlock')
  console.log('')

  console.log('=== F. 레거시 확인 ===')
  const productFull = await prisma.product.findUnique({
    where: { id: productId },
    select: { schedule: true },
  })
  const itineraryCount = await prisma.itinerary.count({ where: { productId } })
  console.log('Product.schedule 존재:', productFull?.schedule != null && productFull.schedule !== '' ? '예' : '없음/빈값')
  console.log('레거시 Itinerary row 수:', itineraryCount)
  console.log('')

  console.log('=== 완료 ===')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
