import { prisma } from '@/lib/prisma'
import { ensureProductSlug, type ProductSlugInput } from '@/lib/product-slug'

/** 공급사 등록 확정 직후 slug 발급(없을 때만). */
export async function persistProductSlugAfterRegister(
  productId: string,
  fields: ProductSlugInput & { slug?: string | null }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await ensureProductSlug(tx, productId, fields)
  })
}
