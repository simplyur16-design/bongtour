import { OVERSEAS_HUB_CATALOG_CLIENT_VERSION } from '@/lib/overseas-hub-catalog-version'
import { safeRevalidatePath, safeRevalidateTag } from '@/lib/safe-next-cache-revalidate'

export { OVERSEAS_HUB_CATALOG_CLIENT_VERSION }

/**
 * 자유여행 listing + browse 노출 캐시 무효화.
 * REGRESSION-FREEZE[product-listing-cache-revalidate]: /travel/overseas 포함 — manifest
 * REGRESSION-FREEZE[product-detail-payload-cron-revalidate-safe]: 워커·스크립트는 safeRevalidate — manifest
 * 호출처: 공급사 등록 API 7개, 어드민 PATCH/POST(listingKind·travelScope·registrationStatus 변경 시).
 */
export function revalidateProductListingCaches() {
  safeRevalidateTag('air-hotel-listing', 'product-listing-cache')
  safeRevalidateTag('air-hotel-season', 'product-listing-cache')
  safeRevalidateTag('products-browse', 'product-listing-cache')
  safeRevalidatePath('/', 'product-listing-cache')
  safeRevalidatePath('/travel/overseas', 'product-listing-cache')
  safeRevalidatePath('/travel/air-hotel', 'product-listing-cache')
}
