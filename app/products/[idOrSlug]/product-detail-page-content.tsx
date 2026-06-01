import { headers } from 'next/headers'
import { connection } from 'next/server'
import { notFound, permanentRedirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductDetailView } from '@/app/products/[idOrSlug]/product-detail-view'
import {
  loadProductDetailRowCached,
  consumeProductDetailUnstableCacheMiss,
} from '@/lib/product-detail-page-cache'
import { resolveProductPageAccess } from '@/lib/resolve-product-page-access'
import { runWithQueryLogScope } from '@/lib/prisma-query-log'
import { isMobileUserAgent } from '@/lib/product-detail-viewport-from-ua'
import ProductDetailServerReadySignal from '@/components/products/ProductDetailServerReadySignal'

const FIT_ITINERARY_MASTER_DETAIL_INCLUDE = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      activities: {
        orderBy: { order: 'asc' as const },
        include: { validation: true },
      },
    },
  },
} as const

function loadFitItineraryMasterForProduct(productId: string, productType: string | null | undefined) {
  if (productType !== 'airtel') return Promise.resolve(null)
  return prisma.fitItineraryMaster.findUnique({
    where: { productId },
    include: FIT_ITINERARY_MASTER_DETAIL_INCLUDE,
  })
}

/** Suspense 경계 안 — 스트리밍·`loading.tsx` fallback과 함께 전환 중 스켈레톤 표시 */
export async function ProductDetailPageContent({ idOrSlug }: { idOrSlug: string }) {
  return runWithQueryLogScope(`/products/${idOrSlug}`, () => productDetailPageInner(idOrSlug))
}

async function productDetailPageInner(idOrSlug: string) {
  const perfPage = process.env.BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
  const t0 = perfPage ? Date.now() : 0 // PERF-LOG: 측정 후 제거

  const tResolved = perfPage ? Date.now() : 0 // PERF-LOG: 측정 후 제거
  const { resolved, allowAdminDraft } = await resolveProductPageAccess(idOrSlug)
  const resolveMs = perfPage ? Date.now() - tResolved : 0 // PERF-LOG: 측정 후 제거

  if (allowAdminDraft) await connection()

  if (resolved.kind === 'redirect') {
    permanentRedirect(`/products/${resolved.slug}`)
  }
  if (resolved.kind === 'not_found') {
    notFound()
  }

  const productId = resolved.productId

  const tProduct = perfPage ? Date.now() : 0 // PERF-LOG: 측정 후 제거
  const [travelProduct, fitMaster] = await Promise.all([
    loadProductDetailRowCached(productId, allowAdminDraft),
    loadFitItineraryMasterForProduct(productId, resolved.productType),
  ])
  const productMs = perfPage ? Date.now() - tProduct : 0 // PERF-LOG: 측정 후 제거

  if (perfPage) {
    const cacheMiss = consumeProductDetailUnstableCacheMiss()
    const cacheLabel =
      allowAdminDraft ? 'draft-fresh' : cacheMiss === true ? 'miss' : cacheMiss === false ? 'hit' : 'unknown'
    console.log(
      `[product-detail-perf] slug=${idOrSlug} resolve=${resolveMs}ms product+fit=${productMs}ms total=${Date.now() - t0}ms cache=${cacheLabel}`,
    ) // PERF-LOG: 측정 후 제거
  }

  if (!travelProduct) {
    notFound()
  }

  const userAgent = (await headers()).get('user-agent')
  const isMobile = isMobileUserAgent(userAgent)

  return (
    <>
      <ProductDetailView
        travelProduct={travelProduct}
        fitMaster={fitMaster}
        isMobile={isMobile}
      />
      <ProductDetailServerReadySignal productId={productId} />
    </>
  )
}
