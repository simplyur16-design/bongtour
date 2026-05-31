import { revalidatePath, revalidateTag } from 'next/cache'

export function revalidateProductDetailCaches(productId: string, slug?: string | null) {
  revalidateTag(`product-detail-${productId}`)
  revalidateTag('product-detail')
  revalidatePath(`/products/${productId}`)
  if (slug && slug !== productId) {
    revalidatePath(`/products/${slug}`)
  }
}
