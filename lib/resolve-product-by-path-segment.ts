import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractProductPathIdentifier } from '@/lib/product-public-path'
import { publicProductWhereClause } from '@/lib/product-sales-policy'

const PRODUCT_LOOKUP_SELECT = {
  id: true,
  slug: true,
  registrationStatus: true,
} as const

export type ResolvedProductLookup =
  | { kind: 'not_found' }
  | { kind: 'render'; productId: string; slug: string | null }
  | { kind: 'redirect'; slug: string }

async function findRegisteredProduct(
  where: Prisma.ProductWhereInput
): Promise<{ id: string; slug: string | null; registrationStatus: string | null } | null> {
  return prisma.product.findFirst({
    where: {
      ...where,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    select: PRODUCT_LOOKUP_SELECT,
  })
}

async function findAdminPreviewProduct(
  where: Prisma.ProductWhereInput
): Promise<{ id: string; slug: string | null; registrationStatus: string | null } | null> {
  return prisma.product.findFirst({
    where,
    select: PRODUCT_LOOKUP_SELECT,
  })
}

/**
 * URL 세그먼트(slug 또는 cuid) → 상품 조회.
 * cuid로 접근했는데 slug가 있으면 redirect 반환(호출측에서 permanentRedirect).
 */
export async function resolveProductByPathSegment(
  rawSegment: string,
  opts?: { allowAdminDraft?: boolean }
): Promise<ResolvedProductLookup> {
  const segment = extractProductPathIdentifier(rawSegment)
  if (!segment) return { kind: 'not_found' }

  const bySlug = await findRegisteredProduct({ slug: segment })
  if (bySlug) {
    return { kind: 'render', productId: bySlug.id, slug: bySlug.slug }
  }

  const byId = await findRegisteredProduct({ id: segment })
  if (byId) {
    const slug = byId.slug?.trim()
    if (slug && slug !== segment) {
      return { kind: 'redirect', slug }
    }
    return { kind: 'render', productId: byId.id, slug: byId.slug }
  }

  if (opts?.allowAdminDraft) {
    const draftBySlug = await findAdminPreviewProduct({ slug: segment })
    if (draftBySlug) {
      return { kind: 'render', productId: draftBySlug.id, slug: draftBySlug.slug }
    }
    const draftById = await findAdminPreviewProduct({ id: segment })
    if (draftById) {
      const slug = draftById.slug?.trim()
      if (slug && slug !== segment) {
        return { kind: 'redirect', slug }
      }
      return { kind: 'render', productId: draftById.id, slug: draftById.slug }
    }
  }

  return { kind: 'not_found' }
}
