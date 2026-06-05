/**
 * DB에서 Product.title 등을 직접 수정한 뒤 공개 노출에 반영.
 * — publicDetailPayloadJson 재빌드 (+ 호출측에서 Next revalidate).
 */
import { prisma } from '@/lib/prisma'
import { rebuildProductPublicDetailPayload } from '@/lib/product-public-detail/persist-payload'

export type RefreshProductTitlesFromDbOptions = {
  productIds?: string[]
  slugs?: string[]
  limit?: number
}

export type RefreshProductTitlesFromDbResult = {
  requested: number
  rebuilt: number
  skipped: number
  failed: number
  failedIds: string[]
  products: Array<{ id: string; slug: string | null; title: string }>
}

export async function resolveProductIdsForTitleRefresh(
  options: RefreshProductTitlesFromDbOptions = {},
): Promise<Array<{ id: string; slug: string | null; title: string }>> {
  const { productIds, slugs, limit } = options
  if (productIds?.length) {
    return prisma.product.findMany({
      where: { id: { in: productIds }, registrationStatus: 'registered' },
      select: { id: true, slug: true, title: true },
      orderBy: { id: 'asc' },
    })
  }
  if (slugs?.length) {
    return prisma.product.findMany({
      where: { slug: { in: slugs }, registrationStatus: 'registered' },
      select: { id: true, slug: true, title: true },
      orderBy: { id: 'asc' },
    })
  }
  return prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: { id: true, slug: true, title: true },
    orderBy: { updatedAt: 'desc' },
    ...(limit != null && limit > 0 ? { take: limit } : {}),
  })
}

export async function refreshProductTitlesFromDb(
  options: RefreshProductTitlesFromDbOptions = {},
): Promise<RefreshProductTitlesFromDbResult> {
  const rows = await resolveProductIdsForTitleRefresh(options)
  let rebuilt = 0
  let skipped = 0
  let failed = 0
  const failedIds: string[] = []

  for (const row of rows) {
    try {
      const ok = await rebuildProductPublicDetailPayload(row.id)
      if (ok) rebuilt += 1
      else skipped += 1
    } catch {
      failed += 1
      failedIds.push(row.id)
    }
  }

  return {
    requested: rows.length,
    rebuilt,
    skipped,
    failed,
    failedIds,
    products: rows,
  }
}
