/**
 * B-4-3: 자유여행 블로그 초안용 봉 라벨·상품 컨텍스트 (승인 데이터만).
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import {
  buildAirtelBlogProductMeta,
  type AirtelBlogProductMeta,
} from '@/lib/bong-marketing/product-extractor'

function monthFromCampaignKey(monthKey: string): number | null {
  const m = Number(monthKey.trim().split('-')[1])
  return m >= 1 && m <= 12 ? m : null
}

export type AirtelBlogContextRow = {
  title: string
  summary: string | null
  benefitSummary: string | null
  duration: string | null
  tripDays: number | null
  tripNights: number | null
  productType: string | null
  schedule: string | null
  country: string | null
  city: string | null
  countryKey: string | null
  cityKey: string | null
  airline: string | null
  airportTransferType: string | null
  airtelHotelInfoJson: string | null
}

export type AirtelBlogContext = {
  row: AirtelBlogContextRow
  airtelMeta: AirtelBlogProductMeta
  bongSpotsByCity: Array<{
    title: string
    summary: string | null
    cityKey: string | null
    countryKey: string | null
  }>
  bongFoodsByCity: Array<{ name: string; description: string | null; cityKey: string | null }>
  bongTipsByCityOrCountry: Array<{ title: string; body: string | null }>
  seasonalNotesForMonth: Array<{
    spotTitle: string | null
    month: number
    title: string | null
    body: string | null
  }>
}

/**
 * `monthKey`(YYYY-MM)의 월과 일치하는 시즌 노트·도시 키 기반 봉 라벨을 모읍니다.
 * 운영 데이터가 없으면 빈 배열(모델이 일반 가이드로 보강).
 */
export async function getAirtelBlogContext(
  prisma: PrismaClient,
  productId: string,
  monthKey: string,
): Promise<AirtelBlogContext | null> {
  const monthNum = monthFromCampaignKey(monthKey)
  if (monthNum == null) return null

  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      summary: true,
      benefitSummary: true,
      duration: true,
      tripDays: true,
      tripNights: true,
      productType: true,
      schedule: true,
      country: true,
      city: true,
      countryKey: true,
      cityKey: true,
      airline: true,
      airportTransferType: true,
      airtelHotelInfoJson: true,
    },
  })
  if (!row) return null

  const airtelMeta = buildAirtelBlogProductMeta(row)

  const byId = new Map<
    string,
    { title: string; summary: string | null; cityKey: string | null; countryKey: string | null }
  >()

  const linkedRows = await prisma.productBongSpot.findMany({
    where: { productId },
    include: {
      bongSpot: {
        select: {
          id: true,
          title: true,
          summary: true,
          cityKey: true,
          countryKey: true,
          status: true,
        },
      },
    },
  })
  for (const lr of linkedRows) {
    const s = lr.bongSpot
    if (!s || s.status !== 'approved') continue
    byId.set(s.id, {
      title: s.title.trim(),
      summary: s.summary?.trim() ?? null,
      cityKey: s.cityKey,
      countryKey: s.countryKey,
    })
  }

  const spotOr: Prisma.BongSpotWhereInput[] = []
  if (row.cityKey) {
    spotOr.push({ cityKey: row.cityKey, status: 'approved' })
  }
  if (row.countryKey) {
    spotOr.push({ countryKey: row.countryKey, cityKey: null, status: 'approved' })
  }
  if (spotOr.length > 0) {
    const citySpots = await prisma.bongSpot.findMany({
      where: { OR: spotOr },
      select: {
        id: true,
        title: true,
        summary: true,
        cityKey: true,
        countryKey: true,
      },
      take: 24,
      orderBy: { updatedAt: 'desc' },
    })
    for (const s of citySpots) {
      if (byId.has(s.id)) continue
      byId.set(s.id, {
        title: s.title.trim(),
        summary: s.summary?.trim() ?? null,
        cityKey: s.cityKey,
        countryKey: s.countryKey,
      })
    }
  }

  const bongSpotsByCity = Array.from(byId.values())

  const foodOr: Prisma.BongFoodWhereInput[] = []
  if (row.cityKey) {
    foodOr.push(
      row.countryKey
        ? { cityKey: row.cityKey, countryKey: row.countryKey }
        : { cityKey: row.cityKey },
    )
  }
  if (row.countryKey) {
    foodOr.push({ countryKey: row.countryKey, cityKey: null })
  }

  const bongFoodsByCity =
    foodOr.length > 0
      ? await prisma.bongFood.findMany({
          where: { OR: foodOr, status: 'approved' },
          select: { name: true, description: true, cityKey: true },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        })
      : []

  const tipOr: Prisma.BongTipWhereInput[] = []
  if (row.countryKey) {
    if (row.cityKey) {
      tipOr.push({ countryKey: row.countryKey, cityKey: row.cityKey })
    }
    tipOr.push({ countryKey: row.countryKey, cityKey: null })
  }

  const bongTipsByCityOrCountry =
    tipOr.length > 0
      ? await prisma.bongTip.findMany({
          where: { OR: tipOr, status: 'approved' },
          select: { title: true, body: true },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        })
      : []

  const spotIds = Array.from(byId.keys())
  const seasonalRows =
    spotIds.length > 0
      ? await prisma.bongSeasonalNote.findMany({
          where: {
            bongSpotId: { in: spotIds },
            month: monthNum,
            status: 'approved',
          },
          select: {
            month: true,
            title: true,
            body: true,
            bongSpot: { select: { title: true } },
          },
        })
      : []

  const seasonalNotesForMonth = seasonalRows.map((n) => ({
    spotTitle: n.bongSpot?.title?.trim() ?? null,
    month: n.month,
    title: n.title?.trim() ?? null,
    body: n.body?.trim() ?? null,
  }))

  return {
    row,
    airtelMeta,
    bongSpotsByCity,
    bongFoodsByCity: bongFoodsByCity.map((f) => ({
      name: f.name.trim(),
      description: f.description?.trim() ?? null,
      cityKey: f.cityKey,
    })),
    bongTipsByCityOrCountry: bongTipsByCityOrCountry.map((t) => ({
      title: t.title.trim(),
      body: t.body?.trim() ?? null,
    })),
    seasonalNotesForMonth,
  }
}
