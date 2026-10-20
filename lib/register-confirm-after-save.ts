/**
 * confirm DB 저장 직후 SSOT — 일정·이미지키워드 힐+검증이 끝나기 전에 등록대기(pending) 금지.
 * 캐시 무효화는 게이트 뒤에서 실패해도 confirm을 깨지 않는다.
 * 여정지도는 confirm을 막지 않도록 백그라운드로 스케줄한다.
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 게이트 먼저, 캐시는 터져도 무시 — manifest
 * REGRESSION-FREEZE[product-detail-payload-cron-revalidate-safe]: 스크립트 revalidate invariant skip — manifest
 */
import { applyRegisterPrePhotoQueueGateAfterSave } from '@/lib/register-pending-pre-photo-self-heal'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'
import { revalidateProductDetailCaches } from '@/lib/revalidate-product-detail-caches'
import { scheduleItineraryRouteMapGeneration } from '@/lib/itinerary-route-map-ensure'

export async function finalizeRegisterConfirmAfterSave(productId: string): Promise<void> {
  const id = String(productId ?? '').trim()
  if (!id) return
  try {
    await applyRegisterPrePhotoQueueGateAfterSave(id)
  } catch (err) {
    console.error('[register-confirm-after-save] verify-gate failed', id, err)
  }
  try {
    revalidateProductListingCaches()
    await revalidateProductDetailCaches(id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[register-confirm-after-save] cache skip', id, msg)
  }
  // 상품 등록 자동화: 거점≥2면 Gemini 여정지도 생성 (실패해도 confirm 성공 유지)
  scheduleItineraryRouteMapGeneration(id)
}
