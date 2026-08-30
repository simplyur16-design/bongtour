/**
 * confirm DB 저장 직후 SSOT — 일정·이미지키워드 힐+검증이 끝나기 전에 등록대기(pending) 금지.
 * 캐시 무효화는 게이트 뒤에서 실패해도 confirm을 깨지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 게이트 먼저, 캐시는 터져도 무시 — manifest
 * REGRESSION-FREEZE[product-detail-payload-cron-revalidate-safe]: 스크립트 revalidate invariant skip — manifest
 */
import { applyRegisterPrePhotoQueueGateAfterSave } from '@/lib/register-pending-pre-photo-self-heal'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'
import { revalidateProductDetailCaches } from '@/lib/revalidate-product-detail-caches'

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
}
