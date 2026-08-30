import { rebuildProductPublicDetailPayload } from '@/lib/product-public-detail/persist-payload'
import { safeRevalidatePath, safeRevalidateProductDetailTags } from '@/lib/safe-next-cache-revalidate'

export async function revalidateProductDetailCaches(productId: string, slug?: string | null) {
  try {
    await rebuildProductPublicDetailPayload(productId)
  } catch (err) {
    console.error('[product-public-detail] rebuild on revalidate failed', productId, err)
  }
  safeRevalidateProductDetailTags(productId)
  safeRevalidatePath(`/products/${productId}`, 'product-detail-cache')
  if (slug && slug !== productId) {
    safeRevalidatePath(`/products/${slug}`, 'product-detail-cache')
  }
}
