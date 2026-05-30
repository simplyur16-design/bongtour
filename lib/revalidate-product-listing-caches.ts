import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * 자유여행 listing + browse 노출 캐시 무효화.
 * 호출처: 공급사 등록 API 7개, 어드민 PATCH/POST(listingKind·travelScope·registrationStatus 변경 시).
 */
export function revalidateProductListingCaches() {
  revalidateTag('air-hotel-listing')
  revalidateTag('products-browse')
  revalidatePath('/')
  revalidatePath('/travel/air-hotel')
}
