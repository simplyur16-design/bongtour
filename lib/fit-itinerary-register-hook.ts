import { generateFitItineraryForProduct } from '@/lib/fit-itinerary-generate-for-product'

/** confirm 저장 직후 fire-and-forget — 실패 시 hourly backfill cron이 cover */
export function fireFitItineraryGenerationAfterRegister(
  productId: string,
  productType: string | null | undefined,
): void {
  if (productType !== 'airtel') return
  void generateFitItineraryForProduct(productId).catch((err) => {
    console.error(`[fit-itinerary-hook] failed for ${productId}:`, err)
  })
}
