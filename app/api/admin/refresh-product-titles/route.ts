import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { refreshProductTitlesFromDb } from '@/lib/refresh-product-titles-from-db'
import { revalidateProductDetailCaches } from '@/lib/revalidate-product-detail-caches'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

export const dynamic = 'force-dynamic'

/**
 * DB에서 title 직접 수정 후 공개·목록·상세 캐시 반영.
 * Body(선택): { productIds?: string[], slugs?: string[] }
 * 비우면 registered 전체.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { productIds?: string[]; slugs?: string[] } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const productIds = Array.isArray(body.productIds)
    ? body.productIds.map((s) => String(s).trim()).filter(Boolean)
    : undefined
  const slugs = Array.isArray(body.slugs)
    ? body.slugs.map((s) => String(s).trim()).filter(Boolean)
    : undefined

  const result = await refreshProductTitlesFromDb({
    productIds: productIds?.length ? productIds : undefined,
    slugs: slugs?.length ? slugs : undefined,
  })

  for (const p of result.products) {
    if (result.failedIds.includes(p.id)) continue
    await revalidateProductDetailCaches(p.id, p.slug)
  }
  revalidateProductListingCaches()

  return NextResponse.json({
    ok: true,
    ...result,
    listingCachesInvalidated: true,
  })
}
