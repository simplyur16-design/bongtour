import { revalidatePath, revalidateTag } from 'next/cache'
import { OVERSEAS_HUB_CATALOG_CLIENT_VERSION } from '@/lib/overseas-hub-catalog-version'

export { OVERSEAS_HUB_CATALOG_CLIENT_VERSION }

/**
 * 자유여행 listing + browse 노출 캐시 무효화.
 * REGRESSION-FREEZE[product-listing-cache-revalidate]: /travel/overseas 포함 — manifest
 * 호출처: 공급사 등록 API 7개, 어드민 PATCH/POST(listingKind·travelScope·registrationStatus 변경 시).
 */
export function revalidateProductListingCaches() {
  revalidateTag('air-hotel-listing')
  revalidateTag('air-hotel-season')
  revalidateTag('products-browse')
  revalidatePath('/')
  revalidatePath('/travel/overseas')
  revalidatePath('/travel/air-hotel')
}
