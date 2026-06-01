import { revalidatePath, revalidateTag } from 'next/cache'
import { rebuildProductPublicDetailPayload } from '@/lib/product-public-detail/persist-payload'

export async function revalidateProductDetailCaches(productId: string, slug?: string | null) {
  try {
    await rebuildProductPublicDetailPayload(productId)
  } catch (err) {
    console.error('[product-public-detail] rebuild on revalidate failed', productId, err)
  }
  revalidateTag(`product-detail-${productId}`)
  revalidateTag('product-detail')
  revalidatePath(`/products/${productId}`)
  if (slug && slug !== productId) {
    revalidatePath(`/products/${slug}`)
  }
}
