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

  /** slug·id 순차 조회(2 RTT) 대신 OR 1회 — 전환 속도 */
  const registered = await findRegisteredProduct({
    OR: [{ slug: segment }, { id: segment }],
  })
  if (registered) {
    const slug = registered.slug?.trim()
    if (registered.id === segment && slug && slug !== segment) {
      return { kind: 'redirect', slug }
    }
    return { kind: 'render', productId: registered.id, slug: registered.slug }
  }

  if (opts?.allowAdminDraft) {
    const draft = await findAdminPreviewProduct({
      OR: [{ slug: segment }, { id: segment }],
    })
    if (draft) {
      const slug = draft.slug?.trim()
      if (draft.id === segment && slug && slug !== segment) {
        return { kind: 'redirect', slug }
      }
      return { kind: 'render', productId: draft.id, slug: draft.slug }
    }
  }

  return { kind: 'not_found' }
}
