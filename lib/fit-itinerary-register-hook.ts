import { generateFitItineraryForProduct } from '@/lib/fit-itinerary-generate-for-product'
import { persistRegisterAirtelFitAfterConfirm } from '@/lib/register-airtel-fit-enrich'

/** confirm 저장 직후 fire-and-forget — preview JSON 있으면 persist만, 없으면 Gemini 생성 */
export function fireFitItineraryGenerationAfterRegister(
  productId: string,
  productType: string | null | undefined,
  registerFitItineraryGeminiJson?: string | null,
): void {
  if (productType !== 'airtel') return
  void (async () => {
    if (registerFitItineraryGeminiJson?.trim()) {
      await persistRegisterAirtelFitAfterConfirm(productId, registerFitItineraryGeminiJson, productType)
      return
    }
    const result = await generateFitItineraryForProduct(productId)
    if (!result.success && result.reason !== 'already_exists') {
      console.error(`[fit-itinerary-hook] failed for ${productId}:`, result.reason, result.error)
    }
  })().catch((err) => {
    console.error(`[fit-itinerary-hook] failed for ${productId}:`, err)
  })
}
