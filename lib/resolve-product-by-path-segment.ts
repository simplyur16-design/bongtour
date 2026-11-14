import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractProductPathIdentifier } from '@/lib/product-public-path'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'

const PRODUCT_LOOKUP_SELECT = {
  id: true,
  slug: true,
  registrationStatus: true,
  productType: true,
  listingKind: true,
} as const

type ProductLookupRow = {
  id: string
  slug: string | null
  registrationStatus: string | null
  productType: string | null
  listingKind?: string | null
}

export type ResolvedProductLookup =
  | { kind: 'not_found' }
  | {
      kind: 'render'
      productId: string
      slug: string | null
      productType: string | null
      /** 국외연수(`overseas_training`)면 정식 주소는 `/business/programs/<slug>` — 상세는 301 대상 */
      listingKind?: string | null
    }
  | { kind: 'redirect'; slug: string; listingKind?: string | null }

/**
 * REGRESSION-FREEZE[seo-training-products-301]: `/products/otr-bt-*` 중복 주소 → `/business/programs/*` 정식 주소.
 */
export function isOverseasTrainingListingKind(listingKind: string | null | undefined): boolean {
  return (listingKind ?? '').trim() === OVERSEAS_TRAINING_LISTING_KIND
}

async function findRegisteredProduct(
  where: Prisma.ProductWhereInput
): Promise<ProductLookupRow | null> {
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
): Promise<ProductLookupRow | null> {
  return prisma.product.findFirst({
    where,
    select: PRODUCT_LOOKUP_SELECT,
  })
}

/**
 * REGRESSION-FREEZE[seo-deleted-product-410]: 상태와 무관하게 행이 하나라도 있는지(영구 삭제 판별). 없을 때만 410 대상.
 */
export async function productRowExistsForPathSegment(rawSegment: string): Promise<boolean> {
  const segment = extractProductPathIdentifier(rawSegment)
  if (!segment) return false
  const row = await prisma.product.findFirst({
    where: { OR: [{ slug: segment }, { id: segment }] },
    select: { id: true },
  })
  return row !== null
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
      return { kind: 'redirect', slug, listingKind: registered.listingKind ?? null }
    }
    return {
      kind: 'render',
      productId: registered.id,
      slug: registered.slug,
      productType: registered.productType,
      listingKind: registered.listingKind ?? null,
    }
  }

  if (opts?.allowAdminDraft) {
    const draft = await findAdminPreviewProduct({
      OR: [{ slug: segment }, { id: segment }],
    })
    if (draft) {
      const slug = draft.slug?.trim()
      if (draft.id === segment && slug && slug !== segment) {
        return { kind: 'redirect', slug, listingKind: draft.listingKind ?? null }
      }
      return {
        kind: 'render',
        productId: draft.id,
        slug: draft.slug,
        productType: draft.productType,
        listingKind: draft.listingKind ?? null,
      }
    }
  }

  return { kind: 'not_found' }
}
