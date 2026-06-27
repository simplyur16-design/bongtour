/**
 * 공개 정적 hub·카테고리 페이지 — cache warm cron 대상.
 * 재생성: `node scripts/generate-cache-warm-routes.mjs`
 * @see lib/instrumentation-cache-warm-cron.ts
 */
/**
 * 단일 Next 프로세스가 자기 자신에 HTTP loopback 하면 DB·SSR이 수 분간 점유되어 502 유발.
 * @see lib/instrumentation-cache-warm-cron.ts
 */
export const CACHE_WARM_HTTP_EXCLUDED_ROUTES = [
  '/travel/overseas',
  '/travel/air-hotel',
] as const

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

const httpExcluded = new Set<string>(CACHE_WARM_HTTP_EXCLUDED_ROUTES)

/** HTTP self-fetch 워밍 대상 — 해외·항공+호텔 허브 제외 */
export const CACHE_WARM_HTTP_ROUTES = CACHE_WARM_ROUTES.filter((r) => !httpExcluded.has(r))

export type CacheWarmRoute = (typeof CACHE_WARM_ROUTES)[number]
