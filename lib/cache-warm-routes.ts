/**
 * 공개 정적 hub·카테고리 페이지 — cache warm cron 대상.
 * 재생성: `node scripts/generate-cache-warm-routes.mjs`
 * @see lib/instrumentation-cache-warm-cron.ts
 */
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
