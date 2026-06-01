/**
 * 공개 정적 hub·카테고리 페이지 — cache warm cron 대상.
 * 재생성: `node scripts/generate-cache-warm-routes.mjs`
 * 동적 상품 상세: `getDynamicProductDetailWarmRoutes()` (cron 시작 시 DB 조회)
 * @see lib/instrumentation-cache-warm-cron.ts
 */
import { prisma } from '@/lib/prisma'
import { publicProductPath } from '@/lib/product-public-path'
import { publicProductWhereClause } from '@/lib/product-sales-policy'

export const CACHE_WARM_PRODUCT_DETAIL_LIMIT = 30

export const CACHE_WARM_ROUTES = [
  '/',
  '/air-ticketing',
  '/business',
  '/business/programs',
  '/charter-bus',
  '/inquiry',
  '/privacy',
  '/products',
  '/quote/private',
  '/support',
  '/terms',
  '/training',
  '/travel/air-hotel',
  '/travel/domestic',
  '/travel/esim',
  '/travel/esim/benefits/chatgpt',
  '/travel/esim/benefits/google-maps',
  '/travel/esim/benefits/traveler-verification',
  '/travel/esim/catalog',
  '/travel/esim/devices',
  '/travel/esim/guide',
  '/travel/esim/help/device-compatibility',
  '/travel/esim/help/setup-guide',
  '/travel/esim/policy',
  '/travel/esim/recommend',
  '/travel/overseas',
  '/travel/overseas/private-trip',
  '/travel/overseas/tours-activities',
] as const

export type CacheWarmRoute = (typeof CACHE_WARM_ROUTES)[number]

/** 해외 등록·예약 가능 상품 상위 N건 — `/products/{slug|id}` (cron이 매 tick 갱신) */
export async function getDynamicProductDetailWarmRoutes(
  limit: number = CACHE_WARM_PRODUCT_DETAIL_LIMIT,
): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      hasBookableDepartures: true,
      AND: [publicProductWhereClause()],
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: Math.max(1, Math.min(100, limit)),
    select: { id: true, slug: true },
  })
  return rows.map((p) => publicProductPath(p))
}

export async function getAllCacheWarmRoutes(): Promise<string[]> {
  const dynamic = await getDynamicProductDetailWarmRoutes()
  return [...CACHE_WARM_ROUTES, ...dynamic]
}
