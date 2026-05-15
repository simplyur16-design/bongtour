import { unstable_cache } from 'next/cache'
import type { HubFourCardKey } from '@/lib/main-hub-copy'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { getHomeHubCoverImageUrl } from '@/lib/final-image-selection'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { listPrivateTripHeroStoragePublicUrls } from '@/lib/private-trip-hero-supabase'

export type HubFourPhotoBundle = Record<HubFourCardKey, string | null>

const CANDIDATE_TAKE = 72

async function pickOverseasPackageCoverUrl(): Promise<string | null> {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      NOT: { listingKind: { in: ['air_hotel_free', 'private_trip'] } },
      AND: [publicProductWhereClause()],
    },
    orderBy: { updatedAt: 'desc' },
    take: CANDIDATE_TAKE,
    select: {
      bgImageUrl: true,
      schedule: true,
      itineraries: {
        select: { day: true, description: true },
        orderBy: { day: 'asc' },
        take: 24,
      },
    },
  })

  for (const p of rows) {
    const scheduleDays = getScheduleFromProduct(p)
    const url = (getHomeHubCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays }) ?? '').trim()
    if (url) return url
  }
  return null
}

async function pickAirHotelCoverUrl(): Promise<string | null> {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      listingKind: 'air_hotel_free',
      AND: [publicProductWhereClause()],
    },
    orderBy: { updatedAt: 'desc' },
    take: CANDIDATE_TAKE,
    select: {
      bgImageUrl: true,
      schedule: true,
      itineraries: {
        select: { day: true, description: true },
        orderBy: { day: 'asc' },
        take: 24,
      },
    },
  })

  for (const p of rows) {
    const scheduleDays = getScheduleFromProduct(p)
    const url = (getHomeHubCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays }) ?? '').trim()
    if (url) return url
  }
  return null
}

async function pickPrivateTripHeroFirstUrl(): Promise<string | null> {
  try {
    const urls = await listPrivateTripHeroStoragePublicUrls()
    const first = urls.map((u) => u.trim()).find(Boolean)
    return first ?? null
  } catch {
    return null
  }
}

async function loadHubFourPhotoBundleUncached(): Promise<HubFourPhotoBundle> {
  const [pkg, airHotel, heroFirst] = await Promise.all([
    pickOverseasPackageCoverUrl(),
    pickAirHotelCoverUrl(),
    pickPrivateTripHeroFirstUrl(),
  ])

  return {
    package: pkg,
    'free-travel': airHotel,
    'private-trip': heroFirst,
    business: '/images/home-hub/base/training.webp',
  }
}

const runHubFourPhotoBundle = unstable_cache(loadHubFourPhotoBundleUncached, ['home-hub-four-photo-bundle-v1'], {
  revalidate: 21_600,
})

/**
 * 메인 4허브·모바일 4타일 공통 — 카드별 대표 사진 URL 묶음.
 * ISR 6시간(`revalidate: 21600`) — 메모리 #30 cron 패턴과 별개.
 */
export async function getHubFourPhotosBundle(): Promise<HubFourPhotoBundle> {
  return runHubFourPhotoBundle()
}
